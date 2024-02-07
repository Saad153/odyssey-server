const { DataTypes } = require('sequelize')
const { Employees } = require("../employeeAssociations/");
const { AssignTask } = require("../../../models")

Employees.hasMany(AssignTask, { 
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }

})

AssignTask.belongsTo(Employees, {as : "assignedBy"})

module.exports = {   AssignTask }

