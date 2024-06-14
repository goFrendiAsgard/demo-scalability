const amqp = require('amqplib');
const process = require('process');

const workerName = process.env.WORKER_NAME || 'Worker1';
const rmqConnectionString = process.env.RMQ_CONNECTION || 'amqp://user:password@localhost';

async function consume(rmqConnectionString, queueName) {
  try {
    // Connect to RabbitMQ server with authentication
    const connection = await amqp.connect(rmqConnectionString);
    const channel = await connection.createChannel();

    // Ensure the queue exists, if not, create it
    await channel.assertQueue(queueName, { durable: false });

    console.log(` [*] Waiting for messages in ${queueName}. To exit press CTRL+C`);

    // Consume messages from the queue
    channel.consume(queueName, (msg) => {
      const message = msg.content.toString();
      console.log(` [x] ${workerName} receive ${message}`);
    }, { noAck: true });
  } catch (error) {
    console.error('Error:', error);
  }
}

consume(rmqConnectionString, 'todo');