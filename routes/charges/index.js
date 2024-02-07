const { Charges } = require("../../models");
const routes = require('express').Router();
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

routes.post("/create", async(req, res) => {
    try {
      // console.log(req.body.data)
      let data = req.body.data
      delete data.id
      const check = await Charges.max("code")
      console.log(check)
      // const exists = await Charges.findOne({
      //     where:{code:data.code}
      // });
      // if(exists){
      //     res.json({status:'exists'});
      // } else {
        const result = await Charges.create({...data, code:check? parseInt(check) + 1:1});
        res.json({status:'success', result:result })
      // }
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.post("/edit", async(req, res) => {
  console.log(req.body)
  let tempData = {...req.body.data};
  try {
    const exists = await Charges.findOne({
      where:{
        id:{ [Op.ne]: tempData.id },
        code:{ [Op.eq]: tempData.code}
      }
    });
    if(exists){
      res.json({status:'exists'});
    } else {
      await Charges.update(tempData,{
        where:{id:tempData.id}
      });
      const result = await Charges.findOne({where:{id:tempData.id}})
      res.json({status:'success', result:result});
    }
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

//getAllCharges
routes.get("/get", async(req, res) => {
  try {
    const result = await Charges.findAll();
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

module.exports = routes;