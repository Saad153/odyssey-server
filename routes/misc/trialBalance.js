const { Invoice, Invoice_Losses, Invoice_Transactions } = require("../../functions/Associations/incoiceAssociations");
const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");
const { Vouchers, Voucher_Heads } = require("../../functions/Associations/voucherAssociations");
const { SE_Job } = require("../../functions/Associations/jobAssociations/seaExport");
const { Vendors } = require("../../functions/Associations/vendorAssociations");
const { Clients } = require("../../functions/Associations/clientAssociation");
const { Accounts } = require('../../models/');
const routes = require('express').Router();
const Sequelize = require('sequelize');
const moment = require("moment");
const url = 'trialBalance';
const Op = Sequelize.Op;

routes.get(`/${url}/get`, async(req, res) => {
  try {
    let obj = {
      CompanyId:req.headers.company
    }
    if(req.headers.accountid){
      obj.id = req.headers.accountid
    }
    const result = await Parent_Account.findAll({
      attributes:['id', 'title'],
      where:obj,
      include:[{
        model:Child_Account,
        attributes:['id', 'title'],
        // order: [[{ model: Voucher_Heads }, 'createdAt', 'DESC']],
        include:[{
          model:Voucher_Heads,
          // order: [['createdAt', 'ASC']],
          attributes:['amount', 'defaultAmount', 'type', 'accountType', 'settlement', 'createdAt'],
          where:{
            createdAt: {
              // [Op.gte]: moment(req.headers.from).toDate(),
              [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
            }
          },
        }]
      }],
    });
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

module.exports = routes;