const { Employees } = require("../../functions/Associations/employeeAssociations");
const { AssignTask } = require("../../models");
const routes = require('express').Router();
const Sequelize = require('sequelize');

routes.post('/createTask', async (req, res) =>{
    try {
        //console.log(req.body)
        const result = await AssignTask.create(req.body).catch((x)=>console.log(x))
        res.json({status:"success", result: result})
    } 
    catch (error) {
        res.json({status:'error', result:error});
    }
})

routes.get('/getEmployeeTask', async (req, res) =>{
    try {
        const result = await AssignTask.findAll({where : {EmployeeId : req.headers.id}, 
            include: [{
                model: Employees,
                as: 'assignedBy',
                attributes: ['name']
            }]
        })
        res.json({result: result})
    } 
    catch (error) {
        res.json({status:'error', result:error});
    }
})

module.exports = routes