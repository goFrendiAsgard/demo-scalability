const amqp = require('amqplib');
const http = require('http');
const process = require('process');
const {Client} = require('pg');
const redis = require('redis');

const httpPort = process.env.HTTP_PORT || 3001;
const serverName = process.env.SERVER_NAME || 'Server1';
const rmqConnectionString = process.env.RMQ_CONNECTION || 'amqp://user:password@localhost';
const dbConnectionString = process.env.DB_CONNECTION || 'postgresql://postgres@localhost/store';
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';

const server = http.createServer(async (req, res) => {
  console.log(req.url)
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Welcome to ${serverName}\n`);
  }

  else if (req.url.startsWith('/work')) {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const job = urlParams.get('job') || 'membuat task jira';
    await publish(rmqConnectionString, 'todo', job);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Work received by ${serverName}\n`);
  }
  
  else if (req.url.startsWith('/orders')) {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const orderId = urlParams.get('id') || '1';
    // check from cache first
    console.log('Fetch from cache');
    let jsonRows = await getOrderDetailFromCache(redisHost, redisPort, orderId);
    if (jsonRows === null) {
      // get from db
      console.log('Cache not found, fetch from DB');
      const rows = await getOrderDetailFromDb(dbConnectionString, orderId);
      jsonRows = JSON.stringify(rows);
      // cache the result
      console.log('Cache the result');
      await cacheOrderDetail(redisHost, redisPort, orderId, jsonRows);
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(jsonRows);
  }
  
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found\n');
  }
});

server.listen(httpPort, () => {
  console.log(`${serverName} running on port ${httpPort}`);
});

async function publish(rmqConnectionString, queueName, message) {
  try {
    // Connect to RabbitMQ server with authentication
    const connection = await amqp.connect(rmqConnectionString);
    const channel = await connection.createChannel();

    // Ensure the queue exists, if not, create it
    await channel.assertQueue(queueName, { durable: false });

    // Publish a message to the queue
    channel.sendToQueue(queueName, Buffer.from(message));
    console.log(` [x] ${serverName} Sent ${message}`);

    // Close the connection and exit
    setTimeout(() => {
      connection.close();
    }, 500);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function getOrderDetailFromDb(dbConnectionString, orderId) {
  const client = new Client({
    connectionString: dbConnectionString,
  });
  await client.connect();
  const query = 'SELECT * FROM order_details WHERE order_id = $1';
  const { rows } = await client.query(query, [orderId]);
  client.end();
  return rows;
}

async function getOrderDetailFromCache(redisHost, redisPort, orderId) {
  const client = redis.createClient({host: redisHost, port: redisPort});
  await client.connect();
  const jsonRows = await client.get(orderId);
  await client.quit();
  return jsonRows;
}

async function cacheOrderDetail(redisHost, redisPort, orderId, jsonRows) {
  const client = redis.createClient({host: redisHost, port: redisPort});
  await client.connect();
  client.set(orderId, jsonRows);
  await client.quit();
}