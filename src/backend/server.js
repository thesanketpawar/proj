/**
 * Three-Tier DevOps Project - Backend API
 * Employee Management REST API (Express + MySQL)
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


// ================================
// MySQL Connection Pool
// ================================

const pool = mysql.createPool({

    host: process.env.DB_HOST || 'mysql-service',

    user: process.env.DB_USER || 'root',

    password: process.env.DB_PASSWORD || 'rootpassword',

    database: process.env.DB_NAME || 'employeedb',

    port: process.env.DB_PORT || 3306,

    waitForConnections: true,

    connectionLimit: 10,

    queueLimit: 0

});


const db = pool.promise();



// ================================
// Database Startup Check
// ================================

async function waitForDb(retries = 10, delay = 5000){

    for(let i=0;i<retries;i++){

        try{

            await db.query("SELECT 1");

            console.log("✅ Connected to MySQL database");

            return true;

        }

        catch(error){

            console.log(
                `⏳ Waiting for DB... attempt ${i+1}/${retries}`
            );

            await new Promise(
                resolve=>setTimeout(resolve,delay)
            );

        }

    }


    console.error(
        "❌ Database connection failed"
    );


    return false;

}



// ================================
// Application Health
// Kubernetes Liveness Probe
// ================================

app.get('/health',(req,res)=>{


    res.status(200).json({

        status:"healthy",

        service:"backend"

    });


});




// ================================
// Application Readiness
// Kubernetes Readiness Probe
// ================================

app.get('/ready',async(req,res)=>{


    try{


        await db.query("SELECT 1");


        res.status(200).json({

            status:"ready",

            database:"connected"

        });


    }

    catch(error){


        res.status(503).json({

            status:"not-ready",

            database:"disconnected"

        });


    }


});



// ================================
// Root API
// ================================

app.get('/',(req,res)=>{


    res.json({

        message:"Three Tier Backend API Running",

        status:"OK"

    });


});



// ================================
// Get Employees
// ================================

app.get('/api/employees',async(req,res)=>{


    try{


        const [rows] = await db.query(
            "SELECT * FROM employees ORDER BY id DESC"
        );


        res.json(rows);


    }

    catch(error){


        console.error(error);


        res.status(500).json({

            error:"Failed to fetch employees"

        });


    }


});




// ================================
// Add Employee
// ================================

app.post('/api/employees',async(req,res)=>{


    try{


        const {
            name,
            role,
            department
        } = req.body;



        if(!name || !role || !department){


            return res.status(400).json({

                error:
                "name, role and department are required"

            });


        }



        const [result] = await db.query(

            `
            INSERT INTO employees
            (name,role,department)
            VALUES(?,?,?)
            `,

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

    catch(error){


        console.error(error);


        res.status(500).json({

            error:"Failed to add employee"

        });


    }


});




// ================================
// Delete Employee
// ================================

app.delete('/api/employees/:id',async(req,res)=>{


    try{


        await db.query(

            "DELETE FROM employees WHERE id=?",

            [
                req.params.id
            ]

        );


        res.json({

            message:"Deleted successfully"

        });



    }

    catch(error){


        console.error(error);


        res.status(500).json({

            error:"Delete failed"

        });


    }


});




// ================================
// Start Server
// ================================

let server;


if(require.main === module){


    waitForDb();


    server = app.listen(
        PORT,
        "0.0.0.0",
        ()=>{


            console.log(
                `🚀 Backend server running on port ${PORT}`
            );


        }

    );


}



module.exports={

    app,

    server,

    pool

};
