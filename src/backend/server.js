/**
 * Three-Tier DevOps Project - Backend API
 * Simple Employee Management REST API (Express + MySQL)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const app = express();

const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(bodyParser.json());


// MySQL connection pool
const pool = mysql.createPool({

    host: process.env.DB_HOST || 'mysql-service',

    user: process.env.DB_USER || 'root',

    password: process.env.DB_PASSWORD || 'rootpassword',

    database: process.env.DB_NAME || 'employeedb',

    port: process.env.DB_PORT || 3306,

    waitForConnections:true,

    connectionLimit:10,

    queueLimit:0

});


const db = pool.promise();


// Health check

app.get('/health', async(req,res)=>{

    try{

        await db.query('SELECT 1');

        res.status(200).json({
            status:"healthy",
            db:"connected"
        });

    }

    catch(err){

        res.status(500).json({
            status:"unhealthy"
        });

    }

});


// Root API

app.get('/',(req,res)=>{

    res.json({

        message:"Three Tier Backend API Running",

        status:"OK"

    });

});


// Get employees

app.get('/api/employees',async(req,res)=>{

    try{

        const [rows]=await db.query(
            'SELECT * FROM employees ORDER BY id DESC'
        );

        res.json(rows);

    }

    catch(err){

        console.log(err);

        res.status(500).json({
            error:"Failed fetching employees"
        });

    }

});


// Add employee

app.post('/api/employees',async(req,res)=>{

    try{

        const {
            name,
            role,
            department
        }=req.body;


        const [result]=await db.query(

            'INSERT INTO employees(name,role,department) VALUES(?,?,?)',

            [
                name,
                role,
                department
            ]

        );


        res.status(201).json({

            id:result.insertId,

            name,

            role,

            department

        });


    }

    catch(err){

        console.log(err);

        res.status(500).json({

            error:"Failed adding employee"

        });

    }

});



// Start server

if(require.main === module){

    app.listen(PORT,"0.0.0.0",()=>{

        console.log(
          `🚀 Backend server running on port ${PORT}`
        );

    });

}


module.exports={
    app,
    pool
};
