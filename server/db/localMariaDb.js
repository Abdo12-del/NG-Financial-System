const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const mysql = require('mysql2/promise');

let serverProcess = null;

function getMariaDbPaths(config = {}) {
  const appRoot = path.resolve(__dirname, '../..');
  const mariaRoot = path.join(appRoot, 'mariadb-10.11.7-winx64');
  return {
    mariaRoot,
    dataDir: config.dataDir || process.env.MARIADB_DATA_DIR || path.join(appRoot, 'data', 'mariadb'),
    installerPath: path.join(mariaRoot, 'bin', 'mariadb-install-db.exe'),
    serverPath: path.join(mariaRoot, 'bin', 'mysqld.exe')
  };
}

function initializeDataDirectory({ dataDir, installerPath, mariaRoot, password, port }) {
  if (fs.existsSync(path.join(dataDir, 'mysql'))) return;
  if (!fs.existsSync(installerPath)) {
    throw new Error(`MariaDB installer was not found: ${installerPath}`);
  }

  fs.mkdirSync(dataDir, { recursive: true });
  execFileSync(installerPath, [
    `--datadir=${dataDir}`,
    `--password=${password}`,
    `--port=${port}`,
    '--silent'
  ], { cwd: mariaRoot, stdio: 'pipe' });
}

async function waitForServer(config, processHandle) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (processHandle.exitCode !== null) {
      throw new Error(`MariaDB exited during startup with code ${processHandle.exitCode}`);
    }

    let connection;
    try {
      connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        connectTimeout: 1000
      });
      await connection.query('SELECT 1');
      return;
    } catch (error) {
      lastError = error;
    } finally {
      if (connection) await connection.end().catch(() => {});
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`MariaDB did not become ready: ${lastError?.message || 'startup timed out'}`);
}

async function startLocalMariaDb(config) {
  if (process.platform !== 'win32') {
    throw new Error('The bundled MariaDB server is available only on Windows.');
  }
  if (serverProcess && serverProcess.exitCode === null) return;

  const paths = getMariaDbPaths(config);
  if (!fs.existsSync(paths.serverPath)) {
    throw new Error(`MariaDB server was not found: ${paths.serverPath}`);
  }

  initializeDataDirectory({ ...paths, password: config.password, port: config.port });
  const defaultsFile = path.join(paths.dataDir, 'my.ini');
  serverProcess = spawn(paths.serverPath, [
    `--defaults-file=${defaultsFile}`,
    '--console',
    '--bind-address=127.0.0.1',
    `--port=${config.port}`
  ], { cwd: paths.mariaRoot, stdio: 'ignore', windowsHide: true });

  serverProcess.on('error', error => {
    console.error('Failed to start bundled MariaDB:', error);
  });
  process.once('exit', () => {
    if (serverProcess && serverProcess.exitCode === null) serverProcess.kill();
  });

  await waitForServer(config, serverProcess);
}

async function stopLocalMariaDb() {
  if (serverProcess && serverProcess.exitCode === null) {
    const processToStop = serverProcess;
    processToStop.kill();
    await new Promise(resolve => {
      processToStop.once('exit', resolve);
      if (processToStop.exitCode !== null) resolve();
      setTimeout(resolve, 3000);
    });
  }
  serverProcess = null;
}

module.exports = { startLocalMariaDb, stopLocalMariaDb };