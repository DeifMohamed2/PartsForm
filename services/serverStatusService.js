/**
 * Server Status Service
 * Comprehensive real-time server monitoring for admin dashboard
 * Collects CPU, Memory, Disk, Network, Process, and Service health metrics
 */

const os = require('os');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

class ServerStatusService {
  constructor() {
    this.cpuHistory = [];
    this.memoryHistory = [];
    this.networkHistory = [];
    this.maxHistoryLength = 60; // Keep 60 data points (for 1 minute at 1s intervals)
    this.lastCpuInfo = null;
    this.lastNetworkInfo = null;
    this.logBuffer = [];
    this.maxLogBuffer = 200;
  }

  /**
   * Get comprehensive server status
   */
  async getFullStatus() {
    const [
      systemInfo,
      cpuInfo,
      memoryInfo,
      diskInfo,
      networkInfo,
      processInfo,
      servicesStatus,
      pm2Status,
    ] = await Promise.all([
      this.getSystemInfo(),
      this.getCpuInfo(),
      this.getMemoryInfo(),
      this.getDiskInfo(),
      this.getNetworkInfo(),
      this.getProcessInfo(),
      this.getServicesStatus(),
      this.getPM2Status(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      system: systemInfo,
      cpu: cpuInfo,
      memory: memoryInfo,
      disk: diskInfo,
      network: networkInfo,
      processes: processInfo,
      services: servicesStatus,
      pm2: pm2Status,
      history: {
        cpu: this.cpuHistory.slice(-30),
        memory: this.memoryHistory.slice(-30),
        network: this.networkHistory.slice(-30),
      },
    };
  }

  /**
   * Get basic system information
   */
  getSystemInfo() {
    const uptime = os.uptime();
    const uptimeDays = Math.floor(uptime / 86400);
    const uptimeHours = Math.floor((uptime % 86400) / 3600);
    const uptimeMins = Math.floor((uptime % 3600) / 60);

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      type: os.type(),
      uptime: uptime,
      uptimeFormatted: `${uptimeDays}d ${uptimeHours}h ${uptimeMins}m`,
      loadAvg: os.loadavg(),
      nodeVersion: process.version,
      pid: process.pid,
      cwd: process.cwd(),
    };
  }

  /**
   * Get CPU information with usage calculation
   */
  async getCpuInfo() {
    const cpus = os.cpus();
    const numCores = cpus.length;
    const model = cpus[0]?.model || 'Unknown';
    const speed = cpus[0]?.speed || 0;

    // Calculate CPU usage
    const usage = await this.calculateCpuUsage();

    // Get load average
    const loadAvg = os.loadavg();
    const loadPercent = (loadAvg[0] / numCores) * 100;

    // Store in history
    this.cpuHistory.push({
      timestamp: Date.now(),
      usage: usage,
      load: loadPercent,
    });
    if (this.cpuHistory.length > this.maxHistoryLength) {
      this.cpuHistory.shift();
    }

    return {
      model: model,
      cores: numCores,
      speed: speed,
      usage: Math.round(usage * 100) / 100,
      loadAvg: loadAvg.map((l) => Math.round(l * 100) / 100),
      loadPercent: Math.round(loadPercent * 100) / 100,
      perCore: cpus.map((cpu, i) => ({
        core: i,
        speed: cpu.speed,
        times: cpu.times,
      })),
    };
  }

  /**
   * Calculate actual CPU usage percentage
   */
  calculateCpuUsage() {
    return new Promise((resolve) => {
      const cpus = os.cpus();
      const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
      const totalTick = cpus.reduce(
        (acc, cpu) =>
          acc +
          cpu.times.user +
          cpu.times.nice +
          cpu.times.sys +
          cpu.times.irq +
          cpu.times.idle,
        0,
      );

      if (this.lastCpuInfo) {
        const idleDiff = totalIdle - this.lastCpuInfo.idle;
        const totalDiff = totalTick - this.lastCpuInfo.total;
        const usage = totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;
        this.lastCpuInfo = { idle: totalIdle, total: totalTick };
        resolve(usage);
      } else {
        this.lastCpuInfo = { idle: totalIdle, total: totalTick };
        // First call, estimate from load average
        const loadPercent = (os.loadavg()[0] / cpus.length) * 100;
        resolve(Math.min(loadPercent, 100));
      }
    });
  }

  /**
   * Get memory information with accurate usage for macOS/Linux
   */
  async getMemoryInfo() {
    const totalMem = os.totalmem();
    let usedMem, freeMem, usedPercent;
    
    // On macOS, os.freemem() includes cached memory as "used"
    // We need to get the actual app memory usage
    const platform = os.platform();
    
    if (platform === 'darwin') {
      // macOS - use vm_stat for accurate memory info
      try {
        const vmStatResult = await this.execPromise('vm_stat 2>/dev/null', 3000);
        const pageSize = 16384; // macOS Apple Silicon typically uses 16KB pages
        const lines = vmStatResult.split('\n');
        
        let pagesActive = 0, pagesWired = 0, pagesCompressed = 0;
        
        for (const line of lines) {
          if (line.includes('Pages active:')) {
            pagesActive = parseInt(line.split(':')[1].trim().replace('.', '')) || 0;
          } else if (line.includes('Pages wired down:')) {
            pagesWired = parseInt(line.split(':')[1].trim().replace('.', '')) || 0;
          } else if (line.includes('Pages occupied by compressor:')) {
            pagesCompressed = parseInt(line.split(':')[1].trim().replace('.', '')) || 0;
          }
        }
        
        // Used memory = Active + Wired + Compressed (matches Activity Monitor "Memory Used")
        usedMem = (pagesActive + pagesWired + pagesCompressed) * pageSize;
        freeMem = totalMem - usedMem;
        usedPercent = (usedMem / totalMem) * 100;
      } catch (e) {
        // Fallback to os.freemem()
        freeMem = os.freemem();
        usedMem = totalMem - freeMem;
        usedPercent = (usedMem / totalMem) * 100;
      }
    } else {
      // Linux/Windows - use os module (reasonably accurate)
      freeMem = os.freemem();
      usedMem = totalMem - freeMem;
      usedPercent = (usedMem / totalMem) * 100;
    }

    // Node.js process memory
    const processMemory = process.memoryUsage();

    // Store in history
    this.memoryHistory.push({
      timestamp: Date.now(),
      used: usedPercent,
      heapUsed: processMemory.heapUsed,
    });
    if (this.memoryHistory.length > this.maxHistoryLength) {
      this.memoryHistory.shift();
    }

    return {
      total: totalMem,
      totalGB: Math.round((totalMem / (1024 ** 3)) * 100) / 100,
      free: freeMem,
      freeGB: Math.round((freeMem / (1024 ** 3)) * 100) / 100,
      used: usedMem,
      usedGB: Math.round((usedMem / (1024 ** 3)) * 100) / 100,
      usedPercent: Math.round(usedPercent * 100) / 100,
      process: {
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external,
        rss: processMemory.rss,
        heapTotalMB: Math.round((processMemory.heapTotal / (1024 ** 2)) * 100) / 100,
        heapUsedMB: Math.round((processMemory.heapUsed / (1024 ** 2)) * 100) / 100,
        rssMB: Math.round((processMemory.rss / (1024 ** 2)) * 100) / 100,
      },
    };
  }

  /**
   * Get disk information
   */
  async getDiskInfo() {
    return new Promise((resolve) => {
      const platform = os.platform();
      
      if (platform === 'win32') {
        exec('wmic logicaldisk get size,freespace,caption', { timeout: 5000 }, (error, stdout) => {
          if (error) {
            resolve([{ mount: 'C:', total: 0, totalGB: 0, used: 0, usedGB: 0, free: 0, freeGB: 0, usedPercent: 0 }]);
            return;
          }
          const lines = stdout.trim().split('\n').slice(1);
          const disks = lines
            .map((line) => {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 3) {
                const free = parseInt(parts[1]) || 0;
                const total = parseInt(parts[2]) || 0;
                const used = total - free;
                return {
                  mount: parts[0],
                  total,
                  totalGB: Math.round((total / (1024 ** 3)) * 100) / 100,
                  used,
                  usedGB: Math.round((used / (1024 ** 3)) * 100) / 100,
                  free,
                  freeGB: Math.round((free / (1024 ** 3)) * 100) / 100,
                  usedPercent: total > 0 ? Math.round((used / total) * 10000) / 100 : 0,
                };
              }
              return null;
            })
            .filter(Boolean);
          resolve(disks.length > 0 ? disks : [{ mount: 'C:', total: 0, totalGB: 0, used: 0, usedGB: 0, free: 0, freeGB: 0, usedPercent: 0 }]);
        });
      } else if (platform === 'darwin') {
        // macOS - use df with 512-byte blocks (default) and convert
        exec("df -k / 2>/dev/null | tail -n 1", { timeout: 5000 }, (error, stdout) => {
          if (error || !stdout.trim()) {
            resolve([{ mount: '/', total: 0, totalGB: 0, used: 0, usedGB: 0, free: 0, freeGB: 0, usedPercent: 0 }]);
            return;
          }
          try {
            const parts = stdout.trim().split(/\s+/);
            // df -k output: Filesystem 1K-blocks Used Available Capacity Mounted
            if (parts.length >= 6) {
              const totalKB = parseInt(parts[1]) || 0;
              const usedKB = parseInt(parts[2]) || 0;
              const freeKB = parseInt(parts[3]) || 0;
              const mount = parts[parts.length - 1];
              
              const total = totalKB * 1024;
              const used = usedKB * 1024;
              const free = freeKB * 1024;
              
              resolve([{
                mount,
                total,
                totalGB: Math.round((total / (1024 ** 3)) * 100) / 100,
                used,
                usedGB: Math.round((used / (1024 ** 3)) * 100) / 100,
                free,
                freeGB: Math.round((free / (1024 ** 3)) * 100) / 100,
                usedPercent: total > 0 ? Math.round((used / total) * 10000) / 100 : 0,
              }]);
            } else {
              resolve([{ mount: '/', total: 0, totalGB: 0, used: 0, usedGB: 0, free: 0, freeGB: 0, usedPercent: 0 }]);
            }
          } catch (e) {
            resolve([{ mount: '/', total: 0, totalGB: 0, used: 0, usedGB: 0, free: 0, freeGB: 0, usedPercent: 0 }]);
          }
        });
      } else {
        // Linux - df with 1K blocks
        exec("df -k / 2>/dev/null | tail -n 1", { timeout: 5000 }, (error, stdout) => {
          if (error || !stdout.trim()) {
            resolve([{ mount: '/', total: 0, totalGB: 0, used: 0, usedGB: 0, free: 0, freeGB: 0, usedPercent: 0 }]);
            return;
          }
          try {
            const parts = stdout.trim().split(/\s+/);
            if (parts.length >= 6) {
              const totalKB = parseInt(parts[1]) || 0;
              const usedKB = parseInt(parts[2]) || 0;
              const freeKB = parseInt(parts[3]) || 0;
              const mount = parts[5];
              
              const total = totalKB * 1024;
              const used = usedKB * 1024;
              const free = freeKB * 1024;
              
              resolve([{
                mount,
                total,
                totalGB: Math.round((total / (1024 ** 3)) * 100) / 100,
                used,
                usedGB: Math.round((used / (1024 ** 3)) * 100) / 100,
                free,
                freeGB: Math.round((free / (1024 ** 3)) * 100) / 100,
                usedPercent: total > 0 ? Math.round((used / total) * 10000) / 100 : 0,
              }]);
            } else {
              resolve([{ mount: '/', total: 0, totalGB: 0, used: 0, usedGB: 0, free: 0, freeGB: 0, usedPercent: 0 }]);
            }
          } catch (e) {
            resolve([{ mount: '/', total: 0, totalGB: 0, used: 0, usedGB: 0, free: 0, freeGB: 0, usedPercent: 0 }]);
          }
        });
      }
    });
  }

  /**
   * Get network information
   */
  async getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const result = {
      interfaces: [],
      connections: 0,
    };

    // Get network interfaces
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (name === 'lo' || name.startsWith('docker')) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          result.interfaces.push({
            name,
            address: addr.address,
            netmask: addr.netmask,
            mac: addr.mac,
          });
        }
      }
    }

    // Get active connections count
    try {
      const platform = os.platform();
      if (platform !== 'win32') {
        let stdout = '';
        if (platform === 'darwin') {
          // macOS: use netstat
          stdout = execSync("netstat -an | grep ESTABLISHED | grep -E '\\.(3000|27017|9200)' | wc -l", { encoding: 'utf8', timeout: 3000 });
        } else {
          // Linux: try ss first, fallback to netstat
          try {
            stdout = execSync("ss -tn state established 2>/dev/null | grep -E ':3000|:27017|:9200' | wc -l", { encoding: 'utf8', timeout: 3000 });
          } catch {
            stdout = execSync("netstat -tn | grep ESTABLISHED | grep -E ':3000|:27017|:9200' | wc -l", { encoding: 'utf8', timeout: 3000 });
          }
        }
        result.connections = Math.max(0, parseInt(stdout.trim()) || 0);
      }
    } catch (e) {
      // Silent fallback
      result.connections = 0;
    }

    // Store in history
    this.networkHistory.push({
      timestamp: Date.now(),
      connections: result.connections,
    });
    if (this.networkHistory.length > this.maxHistoryLength) {
      this.networkHistory.shift();
    }

    return result;
  }

  /**
   * Get top processes by memory/CPU
   */
  async getProcessInfo() {
    return new Promise((resolve) => {
      const platform = os.platform();
      
      if (platform === 'win32') {
        resolve({ top: [] });
        return;
      }

      // Different commands for macOS vs Linux
      if (platform === 'darwin') {
        // macOS: use ps
        exec('ps aux -r | head -11', { timeout: 5000 }, (error, stdout) => {
          if (error || !stdout) {
            resolve({ top: [] });
            return;
          }
          resolve({ top: this._parsePsOutput(stdout) });
        });
      } else {
        // Linux: use top -bn1 (ps can be unreliable in some environments)
        exec('top -bn1 -o %MEM | head -17', { timeout: 10000 }, (error, stdout) => {
          if (error || !stdout) {
            // Fallback to ps
            exec('ps aux --sort=-%mem 2>/dev/null | head -11', { timeout: 5000 }, (err2, stdout2) => {
              if (err2 || !stdout2) {
                resolve({ top: [] });
                return;
              }
              resolve({ top: this._parsePsOutput(stdout2) });
            });
            return;
          }
          resolve({ top: this._parseTopOutput(stdout) });
        });
      }
    });
  }

  /**
   * Parse ps aux output into process objects
   */
  _parsePsOutput(stdout) {
    const lines = stdout.trim().split('\n');
    // Skip header if present (starts with USER)
    const startIndex = lines[0]?.includes('USER') ? 1 : 0;
    
    return lines.slice(startIndex, startIndex + 10).map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 11) {
        return null;
      }
      return {
        user: parts[0],
        pid: parts[1],
        cpu: parseFloat(parts[2]) || 0,
        mem: parseFloat(parts[3]) || 0,
        vsz: parseInt(parts[4]) || 0,
        rss: parseInt(parts[5]) || 0,
        command: parts.slice(10).join(' ').substring(0, 50),
      };
    }).filter(Boolean);
  }

  /**
   * Parse top -bn1 output into process objects
   */
  _parseTopOutput(stdout) {
    const lines = stdout.trim().split('\n');
    // Find the header line (contains PID USER)
    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('PID') && lines[i].includes('USER')) {
        startIndex = i + 1;
        break;
      }
    }
    
    return lines.slice(startIndex, startIndex + 10).map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 12) {
        return null;
      }
      // top format: PID USER PR NI VIRT RES SHR S %CPU %MEM TIME+ COMMAND
      return {
        pid: parts[0],
        user: parts[1],
        cpu: parseFloat(parts[8]) || 0,
        mem: parseFloat(parts[9]) || 0,
        vsz: this._parseMemoryValue(parts[4]),
        rss: this._parseMemoryValue(parts[5]),
        command: parts.slice(11).join(' ').substring(0, 50),
      };
    }).filter(Boolean);
  }

  /**
   * Parse memory value from top (handles K, M, G suffixes)
   */
  _parseMemoryValue(value) {
    if (!value) return 0;
    const num = parseFloat(value);
    if (value.endsWith('g') || value.endsWith('G')) return Math.round(num * 1024 * 1024);
    if (value.endsWith('m') || value.endsWith('M')) return Math.round(num * 1024);
    if (value.endsWith('k') || value.endsWith('K')) return Math.round(num);
    return Math.round(num);
  }

  /**
   * Helper to add timeout to promises
   */
  withTimeout(promise, ms, fallback) {
    return Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
    ]);
  }

  /**
   * Get services status (MongoDB, Elasticsearch, Redis, etc.)
   */
  async getServicesStatus() {
    const services = {
      mongodb: { status: 'unknown', details: {} },
      elasticsearch: { status: 'unknown', details: {} },
      redis: { status: 'unknown', details: {} },
    };

    // Check MongoDB with timeout
    try {
      if (mongoose.connection.readyState === 1) {
        const adminDb = mongoose.connection.db.admin();
        const serverStatus = await this.withTimeout(
          adminDb.serverStatus(),
          3000,
          null
        );
        if (serverStatus) {
          services.mongodb = {
            status: 'healthy',
            details: {
              version: serverStatus.version,
              uptime: serverStatus.uptime,
              uptimeFormatted: this.formatUptime(serverStatus.uptime),
              connections: serverStatus.connections,
              opcounters: serverStatus.opcounters,
              memory: serverStatus.mem,
              storageEngine: serverStatus.storageEngine?.name,
            },
          };
        } else {
          services.mongodb.status = 'timeout';
        }
      } else {
        services.mongodb.status = 'disconnected';
      }
    } catch (e) {
      services.mongodb.status = 'error';
      services.mongodb.error = e.message;
    }

    // Check Elasticsearch with timeout
    try {
      const elasticsearchService = require('./elasticsearchService');
      if (elasticsearchService.client) {
        const [health, stats] = await Promise.all([
          this.withTimeout(elasticsearchService.client.cluster.health(), 3000, null),
          this.withTimeout(elasticsearchService.client.cluster.stats(), 3000, null),
        ]);
        
        if (health) {
          services.elasticsearch = {
            status: health.status === 'green' ? 'healthy' : health.status === 'yellow' ? 'warning' : 'error',
            details: {
              clusterName: health.cluster_name,
              status: health.status,
              numberOfNodes: health.number_of_nodes,
              activeShards: health.active_shards,
              activePrimaryShards: health.active_primary_shards,
              relocatingShards: health.relocating_shards,
              initializingShards: health.initializing_shards,
              unassignedShards: health.unassigned_shards,
              indices: stats?.indices?.count || 0,
              docs: stats?.indices?.docs?.count || 0,
              storeSize: stats?.indices?.store?.size_in_bytes || 0,
              storeSizeGB: Math.round((stats?.indices?.store?.size_in_bytes || 0) / (1024 ** 3) * 100) / 100,
            },
          };
        } else {
          services.elasticsearch.status = 'timeout';
        }
      } else {
        services.elasticsearch.status = 'disconnected';
      }
    } catch (e) {
      services.elasticsearch.status = 'error';
      services.elasticsearch.error = e.message;
    }

    return services;
  }

  /**
   * Get PM2 process status
   */
  async getPM2Status() {
    return new Promise((resolve) => {
      exec('pm2 jlist 2>/dev/null', { timeout: 5000 }, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve({ processes: [], error: 'PM2 not available' });
          return;
        }
        try {
          const processes = JSON.parse(stdout);
          const result = processes.map((p) => ({
            name: p.name,
            pid: p.pid,
            pm_id: p.pm_id,
            status: p.pm2_env?.status,
            cpu: p.monit?.cpu || 0,
            memory: p.monit?.memory || 0,
            memoryMB: Math.round((p.monit?.memory || 0) / (1024 ** 2) * 100) / 100,
            uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
            uptimeFormatted: p.pm2_env?.pm_uptime
              ? this.formatUptime(Math.floor((Date.now() - p.pm2_env.pm_uptime) / 1000))
              : 'N/A',
            restarts: p.pm2_env?.restart_time || 0,
            instances: p.pm2_env?.instances || 1,
            mode: p.pm2_env?.exec_mode || 'fork',
          }));
          resolve({ processes: result });
        } catch (e) {
          resolve({ processes: [], error: e.message });
        }
      });
    });
  }

  /**
   * Get recent logs from Winston logger or PM2
   */
  async getLogs(options = {}) {
    const { lines = 100, type = 'all', search = '' } = options;

    // Try to use Winston logger first for structured logs
    try {
      const logger = require('../utils/logger');
      
      // Map type to Winston log type
      let logType = 'combined';
      if (type === 'error') logType = 'error';
      else if (type === 'http' || type === 'access') logType = 'access';
      else if (type === 'exceptions') logType = 'exceptions';
      
      const logs = await logger.getRecentLogs(logType, lines, search);
      
      if (logs && logs.length > 0) {
        return { 
          logs: logs.map((log, index) => ({
            id: index,
            timestamp: log.timestamp,
            level: log.level || 'info',
            message: log.message || JSON.stringify(log),
            ...log,
          })),
          source: 'winston',
        };
      }
    } catch (e) {
      // Winston not available, fall back to PM2
    }

    // Fallback to PM2/system logs
    return new Promise((resolve) => {
      let cmd = '';

      if (type === 'pm2' || type === 'all') {
        cmd = `pm2 logs --nostream --lines ${lines} 2>&1 | tail -${lines}`;
      } else if (type === 'system') {
        cmd = `journalctl -n ${lines} --no-pager 2>/dev/null || tail -${lines} /var/log/syslog 2>/dev/null || echo "No system logs available"`;
      } else if (type === 'mongodb') {
        cmd = `tail -${lines} /var/log/mongodb/mongod.log 2>/dev/null || echo "MongoDB log not found"`;
      }

      if (!cmd) {
        resolve({ logs: [], error: 'Invalid log type' });
        return;
      }

      exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
        let logLines = stdout.split('\n').filter((line) => line.trim());

        // Filter by search term if provided
        if (search) {
          const searchLower = search.toLowerCase();
          logLines = logLines.filter((line) => line.toLowerCase().includes(searchLower));
        }

        // Parse log lines
        const logs = logLines.map((line, index) => {
          let timestamp = new Date().toISOString();
          let level = 'info';
          let message = line;

          const pm2Match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})?)\s*\|?\s*(.+)$/);
          if (pm2Match) {
            timestamp = pm2Match[1];
            message = pm2Match[3];
          }

          const lineLower = line.toLowerCase();
          if (lineLower.includes('error') || lineLower.includes('err:')) {
            level = 'error';
          } else if (lineLower.includes('warn')) {
            level = 'warn';
          } else if (lineLower.includes('debug')) {
            level = 'debug';
          }

          return { id: index, timestamp, level, message, raw: line };
        });

        resolve({ logs: logs.slice(-lines), source: 'pm2' });
      });
    });
  }

  /**
   * Stream logs in real-time (returns a generator)
   */
  async *streamLogs(type = 'pm2') {
    let cmd = 'pm2 logs --raw';
    if (type === 'system') {
      cmd = 'journalctl -f --no-pager 2>/dev/null || tail -f /var/log/syslog';
    }

    const proc = exec(cmd);
    for await (const chunk of proc.stdout) {
      yield chunk.toString();
    }
  }

  /**
   * Get quick health summary
   */
  async getHealthSummary() {
    const memory = this.getMemoryInfo();
    const cpuUsage = await this.calculateCpuUsage();
    const services = await this.getServicesStatus();

    let overallStatus = 'healthy';
    const issues = [];

    // Check memory
    if (memory.usedPercent > 90) {
      overallStatus = 'critical';
      issues.push('Memory usage above 90%');
    } else if (memory.usedPercent > 80) {
      overallStatus = 'warning';
      issues.push('Memory usage above 80%');
    }

    // Check CPU
    if (cpuUsage > 90) {
      overallStatus = 'critical';
      issues.push('CPU usage above 90%');
    } else if (cpuUsage > 80 && overallStatus !== 'critical') {
      overallStatus = 'warning';
      issues.push('CPU usage above 80%');
    }

    // Check services
    if (services.mongodb.status !== 'healthy') {
      overallStatus = 'critical';
      issues.push('MongoDB is not healthy');
    }
    if (services.elasticsearch.status === 'error') {
      overallStatus = 'critical';
      issues.push('Elasticsearch has errors');
    } else if (services.elasticsearch.status === 'warning' && overallStatus !== 'critical') {
      overallStatus = 'warning';
      issues.push('Elasticsearch has warnings');
    }

    return {
      status: overallStatus,
      issues,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Format uptime seconds to human readable
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }

  /**
   * Promise wrapper for exec with timeout
   */
  execPromise(command, timeout = 5000) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }
}

// Export singleton instance
module.exports = new ServerStatusService();
