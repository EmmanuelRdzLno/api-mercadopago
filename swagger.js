// swagger.js
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API de Pagos con Mercado Pago',
    version: '1.0.0',
    description: 'API REST para generar links de pago de servicios usando Mercado Pago',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor local',
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./server.js'], // Aquí Swagger buscará los comentarios para documentar
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
