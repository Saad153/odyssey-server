const { Vouchers, Voucher_Heads, Office_Vouchers } = require("../../functions/Associations/voucherAssociations");
const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");
const routes = require("express").Router();
const Sequelize = require("sequelize");
const moment = require("moment");
const { Employees } = require("../../functions/Associations/employeeAssociations");
const { Clients, Client_Associations } = require("../../functions/Associations/clientAssociation");
const { Vendors, Vendor_Associations } = require("../../functions/Associations/vendorAssociations");
const { Charge_Head, Invoice, Invoice_Transactions } = require("../../functions/Associations/incoiceAssociations");
const { Accounts } = require('../../models/');
const Op = Sequelize.Op;

//Voucher Types
// (For Jobs)
// Job Reciept 
// Job Recievable
// Job Payment 
// Job Payble
// 0 Unpaid
// 1 Fully-paid
// 2 Half-paid

// (For Expense)
// Expenses Payment
// Office_Vouchers

const setVoucherHeads = (id, heads) => {
  let result = [];
  heads.forEach((x) => {
    result.push({
      ...x,
      VoucherId: id,
      amount: `${x.amount}`
    });
  });
  return result;
};

routes.post("/ApproveOfficeVoucher", async (req, res) => {
  try {
    const result = await Office_Vouchers.update(
      { approved: req.body.approved, VoucherId: req.body.VoucherId },
      { where: { id: req.body.id } }
    );

    res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.post("/recordReverse", async (req, res) => {
  try {
    const result = await Vouchers.findOne({
      where: { id: req.body.VoucherId },
      include: [{ model: Voucher_Heads }]
    })
    await Office_Vouchers.update(
      { reverseAmount: req.body.reverseAmount, paid: req.body.paid },
      { where: { id: req.body.id } }
    );
    res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.post("/OfficeVoucherUpsert", async (req, res) => {
  try {
    const result = await Office_Vouchers.upsert(req.body);
    res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/OfficeVoucherById", async (req, res) => {
  try {
    const result = await Office_Vouchers.findOne({
      where: { id: req.headers.id },
      include: [{ model: Employees, attributes: ['name'] },
      { model: Vouchers, attributes: ['voucher_Id'] }],
    })
    res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/OfficeAllVouchers", async (req, res) => {
  try {
    const result = await Office_Vouchers.findAll({
      attributes: ['id', 'EmployeeId', 'amount', 'requestedBy', 'preparedBy', 'approved', 'paid'],
      where: { CompanyId: req.headers.companyid },
      include: [
        { model: Employees, attributes: ['name'] },
        { model: Vouchers, attributes: ['voucher_Id'] },
      ]
    })
    res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.post("/voucherCreation", async (req, res) => {
  try {
    const check = await Vouchers.findOne({
      order: [["voucher_No", "DESC"]],
      attributes: ["voucher_No"],
      where: { vType: req.body.vType, CompanyId: req.body.CompanyId }
    });
    const result = await Vouchers.create({
      ...req.body,
      voucher_No: check == null ? 1 : parseInt(check.voucher_No) + 1,
      voucher_Id: `${req.body.CompanyId == 1 ?
          "SNS" :
          req.body.CompanyId == 2 ?
            "CLS" : "ACS"
        }-${req.body.vType}-${check == null ? 1 : parseInt(check.voucher_No) + 1
        }/${moment().format("YY")}`,

    }).catch((x) => console.log(x))

    let dataz = await setVoucherHeads(result.id, req.body.Voucher_Heads);
    await Voucher_Heads.bulkCreate(dataz);
    res.json({ status: "success", result: result });
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

routes.post("/voucherEdit", async (req, res) => {
  try {
    await Vouchers.update({ ...req.body }, { where: { id: req.body.id } })
    await Voucher_Heads.destroy({ where: { VoucherId: req.body.id } })
    req.body.Voucher_Heads.forEach(async (x) => {
      await Voucher_Heads.upsert({ ...x, VoucherId: req.body.id, createdAt: req.body.createdAt });
    });
    await res.json({ status: "success" });
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

routes.post("/deleteVoucher", async (req, res) => {
  try {
    let obj = {};
    if (req.body.type == "VoucherId Exists") {
      obj = { id: req.body.id }
    } else {
      obj = {
        invoice_Voucher: "1",
        invoice_Id: req.body.id,
      }
    }
    const findOne = await Vouchers.findOne({
      where: obj,
    });
    const resultOne = await Voucher_Heads.destroy({
      where: { VoucherId: findOne.dataValues.id },
    });
    const resultTwo = await Vouchers.destroy({
      where: { id: findOne.dataValues.id },
    });
    await res.json({ status: "success", result: { resultOne, resultTwo } });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getAccountActivity", async (req, res) => {
  try {
    const { debitaccount, creditaccount } = req.headers;
    let obj = {};
    if (debitaccount != "" && creditaccount == "") {
      obj = { ChildAccountId: debitaccount, type: "debit" };
    } else if (debitaccount == "" && creditaccount != "") {
      obj = { ChildAccountId: creditaccount, type: "credit" };
    } else if (debitaccount != "" && creditaccount != "") {
      obj = {
        [Op.or]: [
          { ChildAccountId: debitaccount, type: "debit" },
          { ChildAccountId: creditaccount, type: "credit" },
        ],
      };
    } else if (debitaccount == "" && creditaccount == "") {
      obj = {};
    }
    const resultOne = await Voucher_Heads.findAll({
      where: obj,
      include: [{ model: Vouchers }],
    });
    let items = [];
    resultOne.forEach((x) => {
      items.push(x.dataValues.Voucher.voucher_Id)
    });

    let voucherIds = [...new Set(items)];
    const result = await Vouchers.findAll({
      attributes: ["voucher_Id", "currency", "exRate", "createdAt"],
      where: {
        voucher_Id: voucherIds,
        createdAt: {
          [Op.gte]: moment(req.headers.from).toDate(),
          [Op.lte]: moment(req.headers.to).add(1, "days").toDate(),
        },
      },
      include: [
        {
          model: Voucher_Heads,
          attributes: ["amount", "type", "defaultAmount"],
          include: [
            {
              model: Child_Account,
              attributes: ["id", "title"],
            },
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getAllVouchers", async (req, res) => {
  try {
    console.log()
    const result = await Vouchers.findAll({
      where: {
        CompanyId: req.headers.id,
        [Op.and]: [
          { type: { [Op.ne]: "Job Payment" } },
          { type: { [Op.ne]: "Job Reciept" } },
        ]
      },
      include: [{
        model: Voucher_Heads,
        attributes: ['type', 'amount'],
        where: { type: "debit" }
      }],
      order: [["createdAt", "DESC"]],
    });
    await res.json({ status: "success", result: result, count:1 });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/testgetAll", async (req, res) => {
  try {
    const result = await Vouchers.findAll({
      where: {
        CompanyId: req.headers.id,
        // [Op.and]: [
        //   { type: { [Op.ne]: "Job Payment" } },
        //   { type: { [Op.ne]: "Job Reciept" } },
        // ]
      },
      attributes: ['createdAt', 'voucher_Id'],
      // include: [{
      //   model: Voucher_Heads,
      //   attributes: ['type', 'amount'],
      //   where: { type: "debit" }
      // }],
      order: [["createdAt", "DESC"]],
    });
    await res.json({ status: "success", result: result, count:1 });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getAllJobPayRecVouchers", async (req, res) => {
  try {
    const result = await Vouchers.findAll({
      order: [["createdAt", "DESC"]],
      where: {
        CompanyId:req.headers.companyid,
        [Op.or]: [
          { type: "Job Reciept" },
          { type: "Job Payment" },
        ],
      },
      include: [{
        model: Voucher_Heads,
        attributes: ['type', 'amount'],
        where: { type: "debit" }
      }],
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getVoucherById", async (req, res) => {
  try {
    const result = await Vouchers.findOne({
      where: { id: req.headers.id },
      include: [
        { 
          model: Voucher_Heads,
          include:[{
            model:Child_Account,
            attributes:['title']
          }]
        }
      ],
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getVoucherByIdAdvanced", async (req, res) => {
  try {
    const result = await Vouchers.findOne({
      where: { id: req.headers.id },
      include: [{
        model: Voucher_Heads,
        include: [{
          model: Child_Account,
          include: [{
            model: Parent_Account,
            include: [{
              model: Accounts
            }]
          }]
        }]
      }],
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getVouchersByEmployeeId", async (req, res) => {
  try {
    const result = await Office_Vouchers.findAll({
      where: { EmployeeId: req.headers.id },
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.post("/deleteBaseVoucher", async (req, res) => {
  try {
    await Voucher_Heads.destroy({ where: { VoucherId: req.body.id } })
    await Vouchers.destroy({ where: { id: req.body.id } })
    await res.json({ status: "success" });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.post("/testDeleteVouchers", async (req, res) => {
  try {

    await Vouchers.destroy({ where: {} })
    await Voucher_Heads.destroy({ where: {} })
    await res.json({ status: "success" });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.post("/getChildAccountIds", async (req, res) => {
  let accountsList = req.body.list;
  let newList = [];
  try {
    const childTwoTest = await Child_Account.findOne({
      where: { title: "CONTRA ACCOUNT OPENINIG" },
      attributes: ['id', 'title'],
      include: [{
        model: Parent_Account,
        where: { CompanyId: 3 },
        attributes: ['CompanyId', 'title']
      }]
    });
    await accountsList.forEach(async (x, i) => {
      await Child_Account.findOne({
        where: { title: x.title },
        attributes: ['id'],
        include: [{
          model: Parent_Account,
          where: { CompanyId: req.body.company }
        }]
      }).then(async (y) => {
        newList.push({
          "type": "Opening Balance",
          "vType": "OP",
          "currency": req.body.currency,
          "exRate": "1",
          "costCenter": "KHI",
          "CompanyId": req.body.company,
          Voucher_Heads: [
            {
              title: "CONTRA ACCOUNT OPENINIG",
              ChildAccountId: childTwoTest.id,
              amount: x.amount,
              type: x.type == "debit" ? "debit" : "credit",
              defaultAmount: x.amount,
            },
            {
              title: x.title,
              ChildAccountId: y?.id,
              amount: x.amount,
              type: x.type == "debit" ? "credit" : "debit",
              defaultAmount: x.amount,
            },
          ]
        })
      })
    });
    const childTwo = await Child_Account.findOne({
      where: { title: "CONTRA ACCOUNT OPENINIG" },
      attributes: ['id', 'title'],
      include: [{
        model: Parent_Account,
        where: { CompanyId: 3 },
        attributes: ['CompanyId', 'title']
      }]
    });
    res.json({ status: "success", result: { newList, childTwo } });
  } catch (error) {
    res.json({ status: "error" });
  }
});

routes.post("/deletePaymentReceipt", async(req, res) => {
  try {

    await Voucher_Heads.destroy({where:{VoucherId:req.body.id}})
    await Invoice_Transactions.destroy({where:{VoucherId:req.body.id}})
    await Vouchers.destroy({where:{id:req.body.id}})

    res.json({status:'success',});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

module.exports = routes;