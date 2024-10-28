import express from 'express';
import mysql from 'mysql';
import cors from 'cors';


const app=express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host : "localhost",
    user : "root",
    password : "",
    database : 'irctc'
});

app.post('/irctc', (req,res)=>{
    console.log("Received data:", req.body);
    const sql= "INSERT INTO users (`name`,`email`,`password`) VALUES (?)";
    const values=[
        req.body.name,
        req.body.email,
        req.body.password
    ]
    db.query(sql,[values], (err,result)=>{
        if(err) {
            console.error("Database error:", err);
            return res.json({Message: "Error in Node"});
        }
        return res.json(result);
    })
})

// Endpoint for user login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const loginQuery = "SELECT id FROM users WHERE email = ? AND password = ?";
    db.query(loginQuery, [email, password], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ Message: "Internal server error" });
        }

        if (result.length === 0) {
            return res.status(401).json({ Message: "Invalid credentials" });
        }

        const userId = result[0].id;
        res.status(200).json({ userId });
    });
});

// Endpoint to get user details
app.get('/user/:id', (req, res) => {
    const userId = req.params.id;
    
    const userQuery = "SELECT name FROM users WHERE id = ?";
    db.query(userQuery, [userId], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ Message: "Internal server error" });
        }

        if (result.length === 0) {
            return res.status(404).json({ Message: "User not found" });
        }

        const userName = result[0].name;
        res.status(200).json({ userName });
    });
});


// Add a new route for inserting train data
app.post('/add-train', (req, res) => {
    console.log("Received train data:", req.body);
    const sql = "INSERT INTO trains (`trainName`, `source`, `destination`, `departureTime`, `arrivalTime`, `departureDate`, `arrivalDate`,`seats`) VALUES (?)";
    const values = [
        req.body.trainName,
        req.body.source,
        req.body.destination,
        req.body.departureTime,
        req.body.arrivalTime,
        req.body.departureDate,
        req.body.arrivalDate,
        req.body.seats,
    ];
    db.query(sql, [values], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ Message: "Error inserting train data" });
        }
        return res.status(201).json({ Message: "Train added successfully!" });
    });
});

app.get('/get-trains', (req, res) => {
    const sql = "SELECT * FROM trains"; // Adjust your query as necessary
    db.query(sql, (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ Message: "Error fetching trains" });
        }
        return res.status(200).json(result); // Send the train data as the response
    });
});

// Add this to your existing Express server code

app.get('/get-trains/:fromStation/:toStation', (req, res) => {
    const { fromStation, toStation } = req.params;
    const sql = "SELECT * FROM trains WHERE source = ? AND destination = ?";
    
    db.query(sql, [fromStation, toStation], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ Message: "Error fetching trains" });
        }
        return res.status(200).json(result); // Send the train data as the response
    });
});

//Book trains
app.post('/book-train', (req, res) => {
    console.log("Received booking request:", req.body); 

    const { trainId, userId } = req.body;
    console.log("Train ID:", trainId);
    console.log("User ID:", userId);

    db.beginTransaction(err => {
        if (err) {
            console.error("Transaction error:", err);
            return res.status(500).json({ Message: "Transaction error" });
        }

        const updateSql = "UPDATE trains SET seats = seats - 1 WHERE train_id = ? AND seats > 0";
        db.query(updateSql, [trainId], (err, result) => {
            if (err) {
                console.error("Error updating seats:", err);
                return db.rollback(() => {
                    return res.status(500).json({ Message: "Error updating seats" });
                });
            }

            if (result.affectedRows === 0) {
                console.warn("No seats available or train not found");
                return db.rollback(() => {
                    return res.status(400).json({ Message: "No seats available or train not found" });
                });
            }

            // Insert booking details into the bookings table
            const insertSql = "INSERT INTO bookings (user_id, trains_id) VALUES (?, ?)";
            db.query(insertSql, [userId, trainId], (err, result) => {
                if (err) {
                    console.error("Error inserting booking:", err);
                    return db.rollback(() => {
                        return res.status(500).json({ Message: "Error inserting booking" });
                    });
                }

                // Commit transaction
                db.commit(err => {
                    if (err) {
                        console.error("Transaction commit error:", err);
                        return db.rollback(() => {
                            return res.status(500).json({ Message: "Error committing transaction" });
                        });
                    }

                    console.log("Booking successful!");
                    return res.status(201).json({ Message: "Booking successful!" });
                });
            });
        });
    });
});

// Get user bookings
app.get('/user-bookings/:userId', (req, res) => {
    const userId = req.params.userId;
    console.log(userId);

    const sql = `
        SELECT b.booking_id AS bookingId, b.user_id, b.trains_id, t.trainName, t.source, t.destination, t.departureTime, t.arrivalTime, b.seats_booked
        FROM bookings b
        JOIN trains t ON b.trains_id = t.train_id
        WHERE b.user_id = ?`;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error("Error retrieving bookings:", err);
            return res.status(500).json({ Message: "Error retrieving bookings" });
        }

        if (results.length === 0) {
            return res.status(404).json({ Message: "No bookings found for this user" });
        }

        return res.status(200).json(results);
    });
});



app.listen(8081, ()=>{
    console.log("Connected to server");
})