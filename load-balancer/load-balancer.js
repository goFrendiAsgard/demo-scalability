const http = require('http');
const httpProxy = require('http-proxy');
const process = require('process');

const HOSTS = (process.env.HOSTS || "localhost,localhost,localhost").split(",")
const PORTS = (process.env.PORTS || "3001,3002,3003").split(",")

// List of backend servers
const servers = []
for (let i = 0; i < HOSTS.length; i++) {
  servers.push({
    host: HOSTS[i],
    port: PORTS[i]
  });
}

let currentIndex = 0;

// Create a proxy server
const proxy = httpProxy.createProxyServer({});

// Function to select the next server in a round-robin fashion
const getNextServer = () => {
  const server = servers[currentIndex];
  currentIndex = (currentIndex + 1) % servers.length;
  return server;
};

// Create an HTTP server to listen for incoming requests
const loadBalancer = http.createServer((req, res) => {
  const target = getNextServer();
  const targetUrl = `http://${target.host}:${target.port}`;
  console.log(`Proxying request to: ${targetUrl}`);
  proxy.web(req, res, { target: targetUrl }, (error) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway');
  });
});

// Start the load balancer on port 3000
loadBalancer.listen(3000, () => {
  console.log('Load balancer running on port 3000');
});
