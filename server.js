require('dotenv').config();
const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const axios = require('axios'); // << Importamos axios
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Swagger docs
app.use('/api-MP', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Configurar cliente de Mercado Pago
const mercadopago = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

// Cliente para preferencias
const preferenceClient = new Preference(mercadopago);

/**
 * @swagger
 * /link-Pago:
 *   post:
 *     summary: Generar un link de pago para un servicio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               unit_price:
 *                 type: number
 *               quantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Link de pago generado exitosamente
 *       500:
 *         description: Error al crear la preferencia
 */
app.post('/link-Pago', async (req, res) => {
  try {
    const { title, unit_price, quantity } = req.body;

    if (!title || !unit_price || !quantity) {
      return res.status(400).json({
        error: 'Faltan datos obligatorios: title, unit_price o quantity',
      });
    }

    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            title,
            unit_price: Number(unit_price),
            quantity: Number(quantity),
          },
        ],
      },
    });

    res.json({
      id_general: preference.id,
      link_de_pago: preference.init_point,
      id_link: preference.collector_id,
    });
    console.log(preference);

  } catch (error) {
    console.error('Error al crear la preferencia:', error);
    res.status(500).json({ error: 'Error al crear el link de pago' });
  }
});


/**
 * @swagger
 * /consulta-pago/{payment_id}:
 *   get:
 *     summary: Consultar el estado de un pago en Mercado Pago
 *     parameters:
 *       - in: path
 *         name: payment_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago a consultar
 *     responses:
 *       200:
 *         description: Información del pago consultado
 *       400:
 *         description: Parámetro faltante o inválido
 *       500:
 *         description: Error al consultar el pago
 */
app.get('/consulta-order/:payment_id', async (req, res) => {
  const paymentId = req.params.payment_id;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!paymentId) {
    return res.status(400).json({ error: 'Se requiere el ID del pago' });
  }

  try {
    const response = await axios.get(`https://api.mercadopago.com/merchant_orders/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error al consultar el pago:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Error al consultar el pago',
      detalles: error.response?.data || error.message,
    });
  }
});

/**
 * @swagger
 * /consulta-order/{payment_id}:
 *   get:
 *     summary: Consultar el estado de un pago en Mercado Pago
 *     parameters:
 *       - in: path
 *         name: payment_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del pago a consultar
 *     responses:
 *       200:
 *         description: Información del pago consultado
 *       400:
 *         description: Parámetro faltante o inválido
 *       500:
 *         description: Error al consultar el pago
 */
app.get('/consulta-pago/:payment_id', async (req, res) => {
  const paymentId = req.params.payment_id;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!paymentId) {
    return res.status(400).json({ error: 'Se requiere el ID del pago' });
  }

  try {
    const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error al consultar el pago:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Error al consultar el pago',
      detalles: error.response?.data || error.message,
    });
  }
});

/**
 * @swagger
 * /consulta-link:
 *   post:
 *     summary: Consulta el estado del link de pago a partir de un webhook de Mercado Pago y envía la orden a otro sistema.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *               api_version:
 *                 type: string
 *               data:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: ID del pago (payment_id)
 *               date_created:
 *                 type: string
 *               id:
 *                 type: integer
 *               live_mode:
 *                 type: boolean
 *               type:
 *                 type: string
 *               user_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Información del pago y la orden asociada enviada correctamente
 *       400:
 *         description: El ID de pago no fue recibido
 *       500:
 *         description: Error al procesar la consulta o envío
 */
app.post('/consulta-link', async (req, res) => {
  const { data } = req.body;
  const payment_id = data?.id;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!payment_id) {
    return res.status(400).json({ error: 'No se encontró el ID de pago en la estructura recibida.' });
  }

  try {
    // Obtener datos del pago
    const paymentResponse = await axios.get(
      `https://api.mercadopago.com/v1/payments/${payment_id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const paymentData = paymentResponse.data;
    const orderId = paymentData.order?.id || paymentData.order_id;

    if (!orderId) {
      console.warn('No se encontró un order_id en el pago recibido');
      return res.sendStatus(200); // Se responde igual con 200, aunque no haya order
    }

    // Obtener datos de la orden
    const orderResponse = await axios.get(
      `https://api.mercadopago.com/merchant_orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const orderData = orderResponse.data;

    // Enviar datos al sistema externo
    try {
      await axios.post(
        'https://orquestador-577166035685.us-central1.run.app/app/webhook/orquestador',
        orderData
      );
    } catch (error) {
      console.error('Error al enviar datos al endpoint externo:', error.response?.data || error.message);
      // Puedes registrar el error, pero igual respondes 200 para que no reintenten la notificación
    }

    return res.sendStatus(200); // Todo bien
  } catch (error) {
    console.error('Error en consulta-link:', error.response?.data || error.message);
    return res.sendStatus(200); // Respondemos 200 igual aunque haya error para evitar reintentos infinitos
  }
});


// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Swagger disponible en http://localhost:${PORT}/api-MP`);
});
