const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();

const port = process.env.PORT || 5001;

//==>>> middleware
app.use(
  //auth step-2 (step 3 ক্লায়েন্ট সাইটে)
  cors({
    // origin: ['http://localhost:5173'],
    origin: [
      'https://truck-doctor.web.app',
      'https://truck-doctor.firebaseapp.com/',
    ],
    credentials: true,
  }),
);
app.use(express.json());

// ‍auth step-7 // ‍auth step -8 is client site
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.71pfsan.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// auth middlewares
const logger = (req, res, next) => {
  console.log('log info : ', req.method, req.url);
  next();
};
// auth step - 9
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log('token in the middleware ::', token);

  if (!token) {
    return res.status(401).send({ message: 'Unauthorized Access' });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized Access.' });
    }
    // console.log('token is decoded by verify', decoded);
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const servicesCollection = client.db('truckDoctor').collection('services');
    const bookingCollection = client.db('truckDoctor').collection('booking');

    //auth related api
    // auth step-1
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '2h',
      });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 60 * 60 * 24 * 7 * 1000, // 1 week
        })
        .send({ success: true });
    });

    // step-5
    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log('from logout', user);
      res.clearCookie('token', { maxAge: 0 }).send({ success: true });
    });

    app.get('/services', async (req, res) => {
      const result = await servicesCollection.find().toArray();
      res.send(result);
    });

    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };
      const result = await servicesCollection.findOne(query, options);
      res.send(result);
    });
    // auth step - 10
    app.get('/bookings', logger, verifyToken, async (req, res) => {
      // auth step - 11
      console.log('User info : ', req.query?.email);
      console.log('Token owner info : ', req.user);
      // console.log('Token is ', req.cookies.token);
      // console.log('Cookie is ', req.cookies);
      // auth step - 11.5
      if (req?.user?.email !== req?.query?.email) {
        return res.status(403).send({ message: 'Forbidden Access' });
      }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query?.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/bookings', async (req, res) => {
      const bookingInfo = req.body;
      console.log(bookingInfo);
      const result = await bookingCollection.insertOne(bookingInfo);
      res.send(result);
    });

    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedBooking = req.body;
      // console.log(booking);
      const updateDoc = {
        $set: {
          status: updatedBooking.status,
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!',
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('App is running...');
});

app.listen(port, () => {
  console.log(`App is running of port ${port}`);
});
