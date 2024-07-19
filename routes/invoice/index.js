const { Charge_Head, Invoice, Invoice_Losses, Invoice_Transactions } = require("../../functions/Associations/incoiceAssociations");
const { SE_Job, SE_Equipments, Bl, Container_Info ,Commodity} = require("../../functions/Associations/jobAssociations/seaExport");
const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");
const { Access_Levels, Employees } = require("../../functions/Associations/employeeAssociations");
const { Vouchers, Voucher_Heads } = require("../../functions/Associations/voucherAssociations");
const { Vendor_Associations } = require("../../functions/Associations/vendorAssociations");
const { Client_Associations } = require("../../functions/Associations/clientAssociation");
const { Vendors } = require("../../functions/Associations/vendorAssociations");
const { Voyage } = require('../../functions/Associations/vesselAssociations');
const { Clients } = require("../../functions/Associations/clientAssociation");
const { Accounts, Vessel, Transaction } = require("../../models");
const routes = require('express').Router();
const Sequelize = require('sequelize');
const moment = require("moment");
const Op = Sequelize.Op;

const numCPUs = require('os').cpus().length;
// Invoice statuses
// 1 = unpaid
// 2 = paid
// 3 = not fully paid

const chardHeadLogic = (currency) => {
  let result = { };
  if(currency!=undefined){
    result = { currency:currency }
  }
  return result;
};

routes.post("/approveCharges", async(req, res) => {
  try {
    let tempIds = [];
    req.body.forEach((x) => { tempIds.push(x.InvoiceId) });

    const lastJB = await Invoice.findOne({ where:{type:'Job Bill'}, order: [[ 'invoice_Id', 'DESC' ]], attributes:["invoice_Id"]});
    const lastJI = await Invoice.findOne({ where:{type:'Job Invoice'}, order: [[ 'invoice_Id', 'DESC' ]], attributes:["invoice_Id"]});
    const lastAI = await Invoice.findOne({ where:{type:'Agent Invoice'}, order: [[ 'invoice_Id', 'DESC' ]], attributes:["invoice_Id"]});
    const lastAB = await Invoice.findOne({ where:{type:'Agent Bill'}, order: [[ 'invoice_Id', 'DESC' ]], attributes:["invoice_Id"]});

    let result = await Invoice.findAll({where:{id:tempIds}});
    let vouchers = [];
    result.forEach(async(x, i) => {
      if(x.status=='0' && x.type=='Job Bill'){
        result[i].status="1"
        result[i].invoice_Id= lastJB.invoice_Id==null?1: parseInt(lastJB.invoice_Id)+1;
        result[i].invoice_No=lastJB.invoice_Id==null?
        `SNS-JB-${1}/${moment().format("YY")}`:
        `SNS-JB-${ parseInt(lastJB.invoice_Id)+1}/${moment().format("YY")}`
      }
      if(x.status=='0' && x.type=='Job Invoice'){
        result[i].status="1"
        result[i].invoice_Id= lastJI.invoice_Id==null?1: parseInt(lastJI.invoice_Id)+1;
        result[i].invoice_No=lastJI.invoice_Id==null?
        `SNS-JI-${1}/${moment().format("YY")}`:
        `SNS-JI-${ parseInt(lastJI.invoice_Id)+1}/${moment().format("YY")}`
      }
      if(x.status=='0' && x.type=='Agent Invoice'){
        result[i].status="1"
        result[i].invoice_Id= lastAI.invoice_Id==null?1: parseInt(lastAI.invoice_Id)+1;
        result[i].invoice_No=lastAI.invoice_Id==null?
        `SNS-AI-${1}/${moment().format("YY")}`:
        `SNS-AI-${ parseInt(lastAI.invoice_Id)+1}/${moment().format("YY")}`
      }
      if(x.status=='0' && x.type=='Agent Bill'){
        result[i].status="1"
        result[i].invoice_Id= lastAB.invoice_Id==null?1: parseInt(lastAB.invoice_Id)+1;
        result[i].invoice_No=lastAB.invoice_Id==null?
        `SNS-AB-${1}/${moment().format("YY")}`:
        `SNS-AB-${ parseInt(lastAB.invoice_Id)+1}/${moment().format("YY")}`
      }
    })

    await res.json({status: 'success', result: result});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.post("/updateCharges", async(req, res) => {
  try {
    req.body.invoice.forEach(async(x)=>{
      await Invoice.update(x,{where:{id:x.id}})
      req.body.charges.forEach(async(y)=>{
        if(x.type==y.invoiceType && y.InvoiceId==x.id){
          await Charge_Head.update({...y, invoice_id:x.invoice_No, status:"1"},{where:{id:y.id}})
        }
      })
    });
    await res.json({status: 'success', result: 'result'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
}); 

routes.post("/saveHeades", async(req, res) => {

  const makeHeads = (data, id) => {
    let result = [];
    data.forEach((x, i)=>{
      result.push({...x, InvoiceId:id})
    });
    return result
  }
  try {
    await Charge_Head.destroy({where:{id:req.body.deleteList}})
    let tempData = [...req.body.invoices];
    const prevInv = await Invoice.findAll({where:{SEJobId:req.body.invoices[0].SEJobId}});
    let tempPrevVal = [];
    prevInv.forEach((z)=>{
      tempPrevVal.push(z.dataValues)
    })
    tempData.forEach((x, i)=>{
      tempData[i].partyType=x.charges[0].partyType;  //<-- Defines The PartyType From Charge Head to Invoice
      tempPrevVal.forEach((y, j)=>{
        if(x.party_Id==y.party_Id && x.type==y.type){
          tempData[i].id=y.id;
          tempPrevVal.splice(j, 1);
        }
      })
    })
    req.body.invoices = tempData;
    for(let i = 0; i<req.body.invoices.length;i++){
      if(req.body.invoices[i].id==null){
        const result = await Invoice.create(req.body.invoices[i]);
        await Charge_Head.bulkCreate(makeHeads(req.body.invoices[i].charges, result.id))
      }

      if(req.body.invoices[i].id!=null){
        for(let j = 0; j<req.body.invoices[i].charges.length;j++){
          //await Invoice.update({req.body.invoices[i], where:{ id:invoices[i].id }});
          await Invoice.update({currency:req.body.invoices[i].currency},{where:{id:req.body.invoices[i].id}});

          if(req.body.invoices[i].charges[j].id!=null){
            await Charge_Head.update(req.body.invoices[i].charges[j], {where:{id:req.body.invoices[i].charges[j].id}})
          }else{
            let val = {...req.body.invoices[i].charges[j], InvoiceId:req.body.invoices[i].id}
            await Charge_Head.create(val);
          }
        }
      }
    }
    res.json({status:'success'});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.get("/getJobInvoices", async(req, res) => {
  try {
    const result = await Invoice.findAll({
      where:{SEJobId:req.headers.id},
      include:[{
        model:Charge_Head,
      }]
    })
    res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getFilteredInvoices", async(req, res) => {
  try {
    const result = await Invoice.findAll({
      where:{type:req.headers.type},
      attributes:['id', 'invoice_No', 'status', 'operation', 'currency', 'ex_rate', 'party_Name', 'total', 'partyType', 'approved'],
      include:[
      { model:SE_Job, attributes:['jobNo'] },
      {
        model:Charge_Head,
        attributes:['charge'],
        where:{charge:{ [Op.ne]: null }}
      }]
    })
    res.json({status:'success', result:result});
  } catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.get("/getInvoiceByNo", async(req, res) => {
  try {
      const attr = [
        'name', 'address1', 'address1', 'person1', 'mobile1',
        'person2', 'mobile2', 'telephone1', 'telephone2', 'infoMail'
      ];
      const resultOne = await Invoice.findOne({
        where:{invoice_No:req.headers.invoiceno.toUpperCase()},
        include:[
          { model:Charge_Head },
          {
            model:SE_Job,
            attributes:[
              'jobNo', 'jobDate', 'shipDate', 'pol', 'pod', 'fd', 'vol', 
              'weight', 'pcs', 'flightNo', 'cwtClient', 'cwtLine', 'eta',
              'etd', 'arrivalDate', 'departureDate'
            ],
            //attributes:['id'],
            include:[
              { model:SE_Equipments , attributes:['qty', 'size'] },
              { 
                model:Bl , attributes:['mbl', 'hbl'],
                include:[{model:Container_Info, attributes:['no']}]
              },
              { model:Voyage , attributes:['voyage', 'importArrivalDate', 'exportSailDate'] },
              { model:Clients, attributes:attr },
              { model:Clients, as:'consignee', attributes:attr },
              { model:Clients, as:'shipper', attributes:attr },
              { model:Vendors, as:'shipping_line', attributes:attr },
              { model:Employees, as:'sales_representator', attributes:['name'] },
              { model:Vessel, as:'vessel', attributes:['carrier', 'name'] },
              { model:Vendors, as:'air_line', attributes:['name'] },
              { model:Commodity, as:'commodity', attributes:['name'] },
              //{ model:Voyage },
            ]
          },
        ],
        order: [
          [{ model: Charge_Head }, 'id', 'ASC'],
        ]
      }).catch((x)=>console.log(x))
      res.json({status:'success', result:{ resultOne }});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getInvoiceById", async(req, res) => {
  try {
      const attr = [
        'name', 'address1', 'address1', 'person1', 'mobile1',
        'person2', 'mobile2', 'telephone1', 'telephone2', 'infoMail'
      ];
      const resultOne = await Invoice.findOne({
        where:{id:{ [Op.eq]: req.headers.invoiceid }},
        include:[
          { model:Charge_Head },
          {
            model:SE_Job,
            attributes:[
              'jobNo', 'jobDate', 'shipDate', 'pol', 'pod', 'fd', 'vol', 'weight', 'pcs', 'flightNo', 'cwtClient', 'cwtLine', 'departureDate'
            ],
            //attributes:['id'],
            include:[
              { model:SE_Equipments , attributes:['qty', 'size'] },
              { 
                model:Bl , attributes:['mbl', 'hbl'],
                include:[{model:Container_Info, attributes:['no']}]
              },
              { model:Voyage , attributes:['voyage', 'importArrivalDate', 'exportSailDate'] },
              { model:Clients, attributes:attr },
              { model:Clients, as:'consignee', attributes:attr },
              { model:Clients, as:'shipper', attributes:attr },
              { model:Vendors, as:'shipping_line', attributes:attr },
              { model:Employees, as:'sales_representator', attributes:['name'] },
              { model:Vessel, as:'vessel', attributes:['carrier', 'name'] },
              { model:Vendors, as:'air_line', attributes:['name'] },
              //{ model:Voyage },
            ]
          },
        ],
        order: [
          [{ model: Charge_Head }, 'id', 'ASC'],
        ]
      }).catch((x)=>console.log(x))
      res.json({status:'success', result:{ resultOne }});
    }
    catch (error) {
      res.json({status:'error', result:error});
      console.log(error)
    }
});

routes.get("/testResetSomeInvoices", async(req, res) => {
  try {

    const result = await Invoice.findAll({
      where:{
        id:[
          '965107244473122817', '965107244473253889', '965107244473286657', '965107244473319425', '965107244473450497', '965107244473483265', '965107244473516033', '965107244473548801', '965107244473581569', '965107244473614337', 965107244473909249,
          '965107244471975937', '965107244472008705', '965107244472172545', '965107244472500225', '965107244472532993', '965107244472565761', '965107244472598529', '965107244472631297', '965107244472827905', '965107244472991745',
          '965107244471353345', '965107244471418881', '965107244471451649', '965107244471484417', '965107244471615489', '965107244471648257', '965107244471713793', '965107244471844865', '965107244471877633', '965107244472041473'
        ]
      }
    });

    res.json({ status:'success', result:result });
  } catch (error) {

    res.json({status:'error', result:error});
  }
});

routes.get("/getAllInoivcesByPartyId", async(req, res) => {
  console.log(req.headers.voucherid + " <<<<=================")
  try {
    let obj = {
      approved:"1",
      party_Id:req.headers.id,
      companyId:req.headers.companyid
      //...chardHeadLogic(req.headers.invoicecurrency)
    }
    if(req.headers.party=="agent"){
      obj.currency = req.headers.invoicecurrency
    } else {
      obj.payType = req.headers.pay
    }
    let transactionObj = [
      { 
        model:SE_Job,  
        attributes:['id', 'jobNo', 'subType'],
        include:[
          {
            model:Bl,
            attributes:['hbl', 'mbl'],
            include:[
              {
                model:Container_Info,
                attributes:['no']
              }
            ]
          },
        ]
        //where:{companyId:req.headers.companyid} 
      },
      //{ model:Charge_Head, attributes:['net_amount', 'local_amount', 'currency', 'ex_rate'] }
    ];
    if(req.headers.edit=='true'){
      obj.id = req.headers.invoices.split(", ")
      transactionObj = [
        ...transactionObj,
        { model:Invoice_Transactions, where:{VoucherId:req.headers.voucherid} }
      ]
    } else {
      obj.status = { [Op.ne]: '2' }
    }
    const result = await Invoice.findAll({
      where:obj,
      attributes:['id','invoice_No', 'invoice_Id', 'payType', 'recieved', 'paid', 'status', 'total', 'currency', 'roundOff', 'party_Id', 'operation', 'ex_rate'],
      order:[['invoice_Id', 'ASC']],
      include:transactionObj
    });
    let partyAccount = null;
    if(result.length>0){
      if(req.headers.party=="vendor"){
        console.log("================Vendor HERE===================")
        partyAccount = await Vendor_Associations.findAll({
          where:{
            VendorId:result[0].party_Id,
            CompanyId:req.headers.companyid  //<-- I'm Unsure About This 
          },
          include:[
            {
              model:Child_Account,
              include:[
                {
                  model:Parent_Account,
                  //where:{ title:req.headers.pay=="Recievable"?"ACCOUNT RECEIVABLE":"ACCOUNT PAYABLE" }
                }
              ]
            }
          ]
        })
      } else if(req.headers.party=="agent"){
        console.log("================Agent HERE===================")
        partyAccount = await Vendor_Associations.findAll({
          where:{
            VendorId:result[0].party_Id,
            CompanyId:req.headers.companyid  //<-- I'm Unsure About This 
          },
          include:[
            {
              model:Child_Account,
              include:[
                {
                  model:Parent_Account,
                  //where:{ title:req.headers.pay=="Recievable"?"ACCOUNT RECEIVABLE":"ACCOUNT PAYABLE" }
                }
              ]
            }
          ]
        })
      } else {
        console.log("================Client HERE===================")
        partyAccount = await Client_Associations.findAll({
          where:{ 
            ClientId:result[0].party_Id, 
            CompanyId:req.headers.companyid 
          },
          include:[
            {
              model:Child_Account,
              include:[
                {
                  model:Parent_Account,
                  //where:{ title:req.headers.pay=="Recievable"?"ACCOUNT RECEIVABLE":"ACCOUNT PAYABLE" }
                }
              ]
            }
          ]
        });
      }
    }

    res.json({ status:'success', result:result, account:partyAccount });
  } catch (error) {

    res.json({status:'error', result:error});
  }
});

routes.get("/getAllOldInoivcesByPartyId", async(req, res) => {
  try {
    const result = await Invoice.findAll({
      where:{
        approved:"1",
        party_Id:req.headers.id,
        payType:req.headers.pay,
        status:"2",
        //...chardHeadLogic(req.headers.invoicecurrency)
      },
      attributes:['id','invoice_No', 'invoice_Id', 'recieved', 'paid', 'status', 'total', 'currency', 'roundOff', 'party_Id'],
      order:[['invoice_Id', 'ASC']],
      include:[
        {
          model:SE_Job,
          attributes:['jobNo', 'subType']
        },
        {
          model:Charge_Head,
          attributes:['net_amount', 'local_amount', 'currency', 'ex_rate']
        }
      ]
    });
    let partyAccount = null;
    if(result.length>0){
      if(req.headers.party=="vendor"){
        console.log("Inside Vendor Association")
        partyAccount = await Vendor_Associations.findAll({
          where:{
            VendorId:result[0].party_Id,
            CompanyId:req.headers.companyid  //<-- I'm Unsure About This 
          },
          include:[
            {
              model:Child_Account,
              include:[
                { 
                  model:Parent_Account,
                  where:{ 
                    title:req.headers.pay=="Recievable"?
                      "ACCOUNT RECEIVABLE":
                      "ACCOUNT PAYABLE" 
                  }
                }
              ]
            }
          ]
        })
      } else if(req.headers.party=="agent"){
        partyAccount = await Vendor_Associations.findAll({
          where:{
            VendorId:result[0].party_Id,
            CompanyId:req.headers.companyid  //<-- I'm Unsure About This 
          },
          include:[
            { model:Child_Account,
              include:[
                { model:Parent_Account, where:{ title:req.headers.pay=="Recievable"?"ACCOUNT RECEIVABLE":"ACCOUNT PAYABLE" } }
              ]
            }
          ]
        })
      } else {
        partyAccount = await Client_Associations.findAll({
          where:{ ClientId:result[0].party_Id, CompanyId:req.headers.companyid },
          include:[
            {
              model:Child_Account,
              include:[
                { model:Parent_Account, where:{ title:req.headers.pay=="Recievable"?"ACCOUNT RECEIVABLE":"ACCOUNT PAYABLE" } }
              ]
            }
          ]
        });
      }
    }
      res.json({ status:'success', result:result, account:partyAccount });
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/dateExperiment", async(req, res) => {
  try {
    const from = moment("2023-02-23");
    const to = moment("2023-02-25");
    const resultOne = await Invoice.findAll({
      where:{
        createdAt: {
          [Op.gte]: from.toDate(),
          [Op.lte]: to.toDate(),
          }
      },
      order: [[ 'createdAt', 'ASC' ]]
    });
    res.json({status:'success', result:{ resultOne }});
    }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.get("/getTransaction", async(req, res) => {
  try {
    let { history, offset, type } = req.headers;
    const count = await Vouchers.count({
      where:{ [Op.or]: [{type: 'Job Reciept'}, {type:'Job Payment'}] },
      });
    if (history=="false" & (type=="front" || type=="last")){
      offset = count - 1;
    } else if(history=="false" & (type=="first" || type=="back")){
      offset = 0
    }
    const result = await Vouchers.findAll({
      limit:1, offset:offset, where:{ [Op.or]: [{type: 'Job Reciept'}, {type:'Job Payment'}] },
    })
    // let ids = result[0].dataValues.invoices.split(", ")
    // const invoices = await Invoice.findAll({
    //   where:{id:ids},
    //   include:[{model:SE_Job, attributes:['jobNo', 'subType']}]
    // })
    await res.json({status: 'success', result:{result:result[0], count, offset}});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.post("/createInvoiceTransaction", async(req, res) => {
  try {
    req.body.invoices.forEach(async(x) => {
      Invoice.update(x, {where:{id:x.id}});
    })
    req.body.invoiceLosses.forEach(async(y)=>{
      Invoice_Transactions.upsert(y)
    })
    res.json({status: 'success', result: 'result'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// round off an invoice
routes.post("/roundOffInv", async(req, res) => {
  try {
    await Invoice.update({ roundOff:req.body.roundOff }, { where:{id:req.body.id} });
    await res.json({status: 'success', result: 'result'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// Approve or disapprove an invoice
routes.post("/invApproveDisapp", async(req, res) => {
  try {
    await Invoice.update({ total:req.body.total, approved:req.body.approved, ex_rate:req.body.exRate, status:"1" }, { where:{id:req.body.id} });
    await res.json({status: 'success', result: 'result'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// Adds a note to invoice and also the currency
routes.post("/addInvoiceNote", async(req, res) => {
  try {
    await Invoice.update({ note:req.body.note, currency:req.body.currency}, { where:{id:req.body.id} });
    await res.json({status: 'success', result: 'result'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.post("/saveChargeHeades", async(req, res) => {
  try {
    await Charge_Head.destroy({where:{id:req.body.deleteList}})
    await SE_Job.update({exRate:req.body.exRate}, {where:{id:req.body.id}})
    await Promise.all([
      req.body.charges.forEach((x) => {
        Charge_Head.upsert(x);
      })
    ]);
    res.json({status:'success'});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

// This api saves the heads added on the related Job
routes.post("/saveHeadesNew", async(req, res) => {
  try {
    req?.body?.deleteList != undefined? await Charge_Head.destroy({where:{id:req.body.deleteList}}) : null;
    req?.body?.id != undefined? await SE_Job.update({exRate:req.body.exRate}, {where:{id:req.body.id}}) : null;

    let data;
    await req.body.charges.forEach(async(x) => {
      data = await Charge_Head.upsert(x);
    });
    res.json({status:'success'});
  }
  catch (error) {
    console.log(error)
    res.json({status:'error', result:error});
  }
});

// This api shows the heads added on the related Job
routes.get("/getHeadesNew", async(req, res) => {
  try {
    const result = await Charge_Head.findAll({
      where:{SEJobId:req.headers.id},
      include:[{model:Invoice, attributes:['status', 'approved']}]
    })
    res.json({status:'success', result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

// This function is used in the API below helps to set invoice number according to the last generated invoice with fiscal year
const createInvoices = (lastJB, init, type, companyId, operation, x) => {
  let company = '';
  let inVoiceDeleteList = []
  if(lastJB?.Charge_Heads?.length==0){
    inVoiceDeleteList.push(lastJB.id)
  }
  let addition = lastJB?.Charge_Heads?.length==0?0:1;
  company = companyId=='1'?"SNS":companyId=='2'?"CLS":"ACS";
  let result = {
    invoice_No:(lastJB==null || lastJB.invoice_Id==null)?`${company}-${init}-${1}/${moment().add(1, 'years').format("YY")}`:`${company}-${init}-${parseInt(lastJB.invoice_Id)+parseInt(addition)}/${moment().add(1, 'years').format("YY")}`,
    invoice_Id: (lastJB==null || lastJB.invoice_Id==null)?1: parseInt(lastJB.invoice_Id)+parseInt(addition),
    type:type,
    companyId:companyId,
    operation:operation,
    payType: x.type,
    party_Id: x.partyId,
    party_Name: x.name,
    SEJobId: x.SEJobId,
    currency:(init=="JB"||init=="JI")?'PKR':x.currency,
    ex_rate:x.ex_rate,
    partyType:x.partyType,
  }
  Invoice.destroy({where:{id:inVoiceDeleteList}})
  return result;
};

// generate new invoice with invoice number (This API generates only invoice numbers)
routes.post("/makeInvoiceNew", async(req, res) => {
  try {
    let result = req.body.chargeList, charges = [], createdInvoice = { };
    const lastJB = await Invoice.findOne({where:{type:'Job Bill'},     order:[['invoice_Id', 'DESC']], attributes:["id","invoice_Id"], include:[{model:Charge_Head, attributes:['id']}]});
    const lastJI = await Invoice.findOne({where:{type:'Job Invoice'},  order:[['invoice_Id', 'DESC']], attributes:["id","invoice_Id"], include:[{model:Charge_Head, attributes:['id']}]});
    const lastAI = await Invoice.findOne({where:{type:'Agent Invoice'},order:[['invoice_Id', 'DESC']], attributes:["id","invoice_Id"], include:[{model:Charge_Head, attributes:['id']}]});
    const lastAB = await Invoice.findOne({where:{type:'Agent Bill'},   order:[['invoice_Id', 'DESC']], attributes:["id","invoice_Id"], include:[{model:Charge_Head, attributes:['id']}]});

    await result.forEach(async(x)=>{
      if(x.invoiceType=="Job Bill"){
        if(Object.keys(createdInvoice).length==0){
          createdInvoice = await createInvoices(lastJB, "JB", "Job Bill", req.body.companyId, req.body.type, x)
        }
        charges.push({...x, status:"1", invoice_id:createdInvoice.invoice_No })
      }
      if(x.invoiceType=="Job Invoice"){
        if(Object.keys(createdInvoice).length==0){
          createdInvoice = await createInvoices(lastJI, "JI", "Job Invoice", req.body.companyId,req.body.type, x)
        }
        charges.push({...x, status:"1", invoice_id:createdInvoice.invoice_No })
      }
      if(x.invoiceType=="Agent Invoice"){
        if(Object.keys(createdInvoice).length==0){
          createdInvoice = await createInvoices(lastAI, "AI", "Agent Invoice", req.body.companyId,req.body.type, x)
        }
        charges.push({...x, status:"1", invoice_id:createdInvoice.invoice_No })
      }
      if(x.invoiceType=="Agent Bill"){
        if(Object.keys(createdInvoice).length==0){
          createdInvoice = await createInvoices(lastAB, "AB", "Agent Bill", req.body.companyId,req.body.type, x)
        }
        charges.push({...x, status:"1", invoice_id:createdInvoice.invoice_No })
      }
    });
    
    const newInv = await Invoice.create(createdInvoice);
    // const newCharges = await charges.map((x)=>{
    //   return{ ...x, InvoiceId:newInv.id }
    // })
    await charges.forEach((x) => {
      Charge_Head.upsert({ ...x, InvoiceId:newInv.id });
    })
    await res.json({status: 'success'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// To display invoices in Invoices page present in accounts tab
routes.get("/getInvoices", async(req, res) =>{
  try {
    const result = await Invoice.findAll({
      where: {SEJobId: req.headers.id},
      attributes: ['invoice_No', 'payType', 'total', 'recieved', 'ex_rate'],
      include:[{
        model:Charge_Head,
        attributes:['charge'],
        where:{charge:{ [Op.ne]: null }}
      }]
    })
    res.json({status: 'success', result: result});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// For Experimental Purposes
routes.get('/getTaskInvoices', async(req, res) => {
  try {
    const result = await Invoice.findAll({ where: {status: "2" , approved: "1"}})
    res.json({status: 'success', result: result});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// For Experimental Purposes
routes.get('/getCPUS', async(req, res) => {
  try {
    //const result = await Invoice.findAll({ where: {status: "2" , approved: "1"}})
    res.json({status: 'success', result: numCPUs});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// For Data Backup
routes.get('/testGetLastInvoice', async(req, res) => {
  try {
    const lastJI = await Invoice.findOne({ 
      //limit:1,
      where:{type:'Job Invoice'},
      order: [['invoice_Id', 'DESC']],
      attributes:["invoice_Id"]
    });
    res.json({status: 'success', result: lastJI});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// displays job data according to Invoice balance Page
routes.get("/jobBalancing", async (req, res) => {
  try {
    let invoiceObj = {
      // below condition sets the date range
      createdAt: {
        [Op.gte]: moment(req.headers.from).toDate(),
        [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
      },
      status:{ [Op.ne]: null },
      // below condition make sures to display only Job-Invoice & Job-Bill
      [Op.and]: [
        { type: { [Op.ne]: "Agent Invoice" } },
        { type: { [Op.ne]: "Old Agent Invoice" } },
        { type: { [Op.ne]: "Agent Bill" } },
        { type: { [Op.ne]: "Old Agent Bill" } },
      ]
    };
    // below condition sets if both payble & receivable invoices/bills are being called
    if(req.headers.paytype!="All"){
      invoiceObj.payType=req.headers.paytype
    }
    // party wise invoice/bill
    req.headers.party?invoiceObj.party_Id=req.headers.party:null;
    // Company wise invoice/bill
    if(req.headers.company=='4'){
      invoiceObj = {
        ...invoiceObj,
        [Op.or]: [{companyId: '1'}, {companyId:'3'}]
      }
    } else {
      req.headers.company?invoiceObj.companyId=req.headers.company:null;
    }
    // Currency wise invoice/bill
    req.headers.currency?invoiceObj.currency=req.headers.currency:null;
    // Job Type/operation wise invoice/bill
    req.headers.jobtypes?.length>0?invoiceObj.operation=req.headers.jobtypes.split(","):null;

    // To include the Job, Bl & Equipments data in the invoices
    let includeObj = {
      model:SE_Job,
      include:[
        { model:Clients, attributes:['code','name'] },
        { model:Bl, attributes:['hbl','mbl'] },
        { model:SE_Equipments, attributes:['qty', 'size'] },
        {
          model: Clients,
          as:'consignee', 
          attributes:['name']
        },
        {
          model: Employees,
          as:'sales_representator', 
          attributes:['name']
        },
        {
          model: Vessel,
          as:'vessel', 
          attributes:['name']
        },
        {
          model: Vendors,
          as:'shipping_line', 
          attributes:['name']
        },
      ],
      attributes:['id','weight','vol', 'fd', 'freightType', 'jobNo', 'operation','subType','jobDate','shipDate','arrivalDate'],
    }

    // overseas agent wise invoice/bill
    req.headers.overseasagent?includeObj.where = {overseasAgentId:req.headers.overseasagent}:null;
    const result = await Invoice.findAll({
      where:invoiceObj,
      attributes:['id','invoice_No', 'payType', 'currency', 'ex_rate', 'roundOff', 'total', 'paid', 'recieved', 'createdAt', 'party_Name'],
      include:[includeObj],
      order: [[ 'createdAt', 'ASC' ]],
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

// this below api is just a copy of the above api just it's specifically for Agent-Invoices/Agent-Bills only
routes.get("/invoiceBalancing", async (req, res) => {
  try {
    let invoiceObj = {
      createdAt: {
        [Op.gte]: moment(req.headers.from).toDate(),
        [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
      },
      status:{ [Op.ne]: null },
      [Op.and]: [
        { type: { [Op.ne]: "Job Invoice" } },
        { type: { [Op.ne]: "Old Job Invoice" } },
        { type: { [Op.ne]: "Job Bill" } },
        { type: { [Op.ne]: "Old Job Bill" } },
      ]
    };
    if(req.headers.paytype!="All"){
      invoiceObj.payType=req.headers.paytype
    }
    if(req.headers.company=='4'){
      invoiceObj = {
        ...invoiceObj,
        [Op.or]: [{companyId: '1'}, {companyId:'3'}]
      }
    } else {
      req.headers.company?invoiceObj.companyId=req.headers.company:null;
    }
    // req.headers.currency?invoiceObj.currency=req.headers.currency:null;
    // req.headers.jobtypes?.length>0?invoiceObj.operation=req.headers.jobtypes.split(","):null;
    
    (req.headers.overseasagent!=''&&req.headers.overseasagent!=null)?invoiceObj.party_Id=req.headers.overseasagent:null;
    const result = await Invoice.findAll({
      where:invoiceObj,
      attributes:['id', 'invoice_No', 'payType', 'currency', 'ex_rate', 'roundOff', 'total', 'paid', 'recieved', 'createdAt', 'party_Name'],
      include:[{
        model:SE_Job,
        include:[
          {
            model:Bl,
            attributes:['hbl'],
          },
          {
            model:SE_Equipments,
            attributes:['qty', 'size']
          }
        ],
        order: [[ 'createdAt', 'ASC' ]],
        attributes:['id', 'fd', 'freightType', 'jobNo', 'operation'],
      }]
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

// For Data Backup
routes.get("/invoiceTest", async (req, res) => {
  try {

    const from = moment("2023-09-08");
    const to   = moment("2023-09-10");
    const result = await Invoice.findAll({
      where:{
        createdAt: {
          [Op.gte]: from.toDate(),
          [Op.lte]: to.toDate(),
         }
      },
      order: [[ 'createdAt', 'ASC' ]]
    });

    await res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

// For Data Backup
routes.post("/uploadbulkInvoicesTest", async (req, res) => {
  try {
    const resultOne = await Clients.findOne({
      where:{name:req.body.party_Name},
      attributes:['id']
    })
    const resultTwo = await Vendors.findOne({
      where:{name:req.body.party_Name},
      attributes:['id']
    })
    await res.json({ status:"success", result:resultOne?resultOne.id:resultTwo.id });
  } catch (error) {
    console.log(error);
    console.log(req.body.party_Name);
    res.json({ status: "error", result: error });
  }
});

// For Data Backup
routes.post("/createBulkInvoices", async (req, res) => {
  try {
    await Invoice.bulkCreate(req.body)
    .catch((x)=>{
      console.log(x)
    })
    await res.json({ status: "success" });
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

// For Data Backup
routes.get("/getClientsWithACPayble", async (req, res) => {
  try {
    const result = await Clients.findAll({
      include:[{
        model:Client_Associations,
        include:[{
          model:Parent_Account,
          where:{CompanyId:'1'}
        }]
      }]
    })
    .catch((x)=>{
      console.log(x)
    })
    await res.json({ status: "success", result});
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

module.exports = routes;        