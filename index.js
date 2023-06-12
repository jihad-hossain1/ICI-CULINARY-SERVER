const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRT_KEY);

  
// const stripe = require("stripe")(pr);



app.use(cors());
app.use(express.json());

// random token genarator
// require('crypto').randomBytes(64).toString('hex')

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xd4auwc.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'Unauthorized Access' })
  }
  const token = authorization.split(' ')[1]
  console.log(token)
  jwt.verify.apply(token, process.env.JWT_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'Unauthorized Access' })
    }
    req.decoded = decoded
    next()
  })

}

async function run() {
  try {
    // await client.connect();

    const usersCollection = client.db("iciCulinary").collection("users");
    const classCollection = client.db("iciCulinary").collection("class");
    const instructorCollection = client
      .db("iciCulinary")
      .collection("instructor");
    const studentCollection = client
      .db("iciCulinary")
      .collection("student");


    /**
   * --------------------------
   *   ** payment API SECTION **
   * --------------------------
   */
    // payment client secret
    app.post('/create-payment-intent', async (req, res) => {
      const { classPrice } = req.body
      const amount = classPrice * 100;
      console.log(classCollection, amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
      
    })
    /**
     * --------------------------
     *   ** jwt API SECTION **
     * --------------------------
     */
    app.post('/jwt', (req, res) => {
      const email = req.body
      const token = jwt.sign(email, process.env.JWT_TOKEN, { expiresIn: '1h' })
      res.send({ token })
    })


    /**
     * --------------------------
     *   ** USER API SECTION **
     * --------------------------
     */

    // get user all
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })
    // users api section
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body
      const query = { email: email }
      const options = { upsert: true }
      const updateDoc = {
        $set: user,
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
      console.log(result);
      res.send(result)
    })

    // make a user admin
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });
    app.get("/users/instructor/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });
    app.get("/users/normalUser/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { normalUser: user?.role !== "instructor" || user?.role !== "admin" };
      res.send(result);
    });

    // app.get('/users/instructor', async (req, res) => {
    //   const approve = await usersCollection.findOne({ "role": "instructor" })
    //   // const result = await approve.toArray();
    //   res.send(approve)
    // })
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // make a user admin api
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })
    // make a user instructor api
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'instructor'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })
    // delete a user by id
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    /**
     * --------------------------
     *   ** Admin API SECTION **
     * --------------------------
     */
    // make a class approve api
    app.patch('/instructor/approve/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      console.log(filter);
      const updateDoc = {
        $set: {
          status: 'approve'
        }
      }
      console.log(updateDoc);
      const result = await classCollection.updateOne(filter, updateDoc)
      res.send(result)
    })
    // make a class reject api
    app.patch('/instructor/reject/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: 'reject'
        }
      }
      const result = await classCollection.updateOne(filter, updateDoc)
      res.send(result)
    })





    /**
     * --------------------------
     *   ** CLASS API SECTION **
     * --------------------------
     */
    // class add by instructor api
    app.post("/class", async (req, res) => {
      const classPost = req.body;
      const result = await classCollection.insertOne(classPost);
      res.send(result);
    });
    //get class api
    app.get("/class", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });
    app.get('/approvedClasses', async (req, res) => {
      const approve = classCollection.find({ "status": "approve" })
      const result = await approve.toArray();
      res.send(result)
    })
    // get data by single id
    app.get('/class/:id', async (req, res) => {
      // const decodedEmail = req.decoded.email
      // console.log(decodedEmail);
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.findOne(query)
      res.send(result)
    })
    // delete class by single id
    app.delete("/class/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result);
    });

    // approved class api
    // app.get('/class/:approve', async (req, res) => {
    //   const approve = req.params.approve
    //   console.log(approve);
    //   const quary = { 'status': approve }
    //   const result = await classCollection.find(quary).toArray()
    //   res.send(result)
    // })
    // app.get("/class", verifyJWT, async (req, res) => {
    //   const status = req.query.status;
    //   // const decodedEmail = req.decoded.email;
    //   const query = { status: status='approve' };
    //   const result = await classCollection.find(query).toArray();
    //   res.send(result);
    // });

    /**
     * --------------------------
     *   ** INSTRUCTOR API SECTION **
     * --------------------------
     */
    // instructor add by admin api
    app.post("/instructor", async (req, res) => {
      const instructorPost = req.body;
      const result = await instructorCollection.insertOne(instructorPost);
      res.send(result);
    });
    //get instructor
    app.get("/instructor", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await instructorCollection.find(query).toArray();
      res.send(result);
    });

    //update class
    app.put('/instructor/:id', verifyJWT, async (req, res) => {
      const isClass = req.body
      console.log(isClass)

      const filter = { _id: new ObjectId(req.params.id) }
      const options = { upsert: true }
      const updateDoc = {
        $set: room,
      }
      const result = await instructorCollection.updateOne(filter, updateDoc, options)
      res.send(result)
    })

    /**
     * --------------------------
     *   ** STUDENTS API SECTION **
     * --------------------------
     */
    // student enroll added to cart  api
    app.post("/student", async (req, res) => {
      const instructorPost = req.body;
      const result = await studentCollection.insertOne(instructorPost);
      res.send(result);
    });
    //get student enroll api
    app.get("/student", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await studentCollection.find(query).toArray();
      res.send(result);
    });
    // student cart 
    app.get("/students", verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const result = await studentCollection.find(query).toArray();
      res.send(result);
    });
    app.get('/student/:id', async (req, res) => {
      // const decodedEmail = req.decoded.email
      // console.log(decodedEmail);
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await studentCollection.findOne(query)
      res.send(result)
    })
    // delete enroll by single id
    app.delete("/student/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await studentCollection.deleteOne(query);
      res.send(result);
    });
    // update a booking status 
    app.put('/student/status/:id', async (req, res) => {
      const id = req.params.id
      const status = req.body.status
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          booked: status,
        },
      }
      const update = await studentCollection.updateOne(query, updateDoc)
      res.send(update)
    })


    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {

    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("ici culinary server is running ");
});

app.listen(port, () => {
  console.log(`ici culinary server runnig on port ${port}`);
});