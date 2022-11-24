const express = require('express');
const router = express.Router();
const auth = require('../Middleware/Auth')
const role = require('../Middleware/Role')
const fs = require('fs')
const path = require('path')
const JSZip = require('jszip');

const {body, validationResult, param} = require("express-validator");
const { Leads, Units, UnitPrice, Orders, OrderUsers, OrderPaymentPlan, UnitPriceOld} = require("../Database/Models");

router.use(auth);
router.use(role);

router.post('/add', body('Unit').custom((value,{req})  => Units.query((qb)=>{
    qb.where('ID',value);
}).fetchAll().then((e) => {
        req.units = e.toJSON();
    }).catch(function (e) {

         throw new Error('Please select unit!');
})),
    body('Leads').custom((value)  => Leads.query((qb)=>{
        qb.where('ID',value.ID);
}).fetchAll().catch(function () {
    throw new Error('Please select lead!');
})), body('Contacts').isArray().custom((value,{req})  => {
        if(value.length === 0){
            if(req.body.Company.length === 0){
                throw new Error('Please select contacts or company!');
                return false;
            }
        }
        return true;
    }), body('Company').isArray().custom((value,{req})  => {
        if(value.length === 0){
            if(req.body.Contacts.length === 0){
                throw new Error('Please select contacts or company!');
                return false;
            }
        }
        return true;
    }),
    body('BasePrice').notEmpty().withMessage('Please enter unit price!'),
    body('PaymentList').isArray().custom((value,{req})  => {
        if(value.length === 0){
                throw new Error('Please select enter payment list!');
             return false;
        }

        for(let i in value){
                if(!value[i].Name || !value[i].PaymentPrice || !value[i].PaymentDate){
                    throw new Error('Please select valid payment data!');
                    return false;
                }
        }
        return true;
    }),
    (req,res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            result: false,
            message: errors.array()
        });
    }


    UnitPrice.where('Unit',req.body.Unit).fetch().then(function (e) {
        UnitPriceOld.forge({
            Unit:req.body.Unit,
            BasePrice:e.get('BasePrice'),
            Premium:e.get('PremiumPrice'),
            PremiumPercent:e.get('PremiumPercent'),
            DiscountPercent:e.get('DiscountPercent'),
            DiscountPrice:e.get('DiscountPrice'),
            PriceOnApplication:e.get('PriceOnApplication'),
            Negotiable:e.get('Negotiable'),
        }).save().then(e => {
            UnitPrice.where('Unit',req.body.Unit).save({
                Unit:req.body.Unit,
                BasePrice:req.body.BasePrice,
                Premium:req.body.PremiumPrice,
                PremiumPercent:req.body.PremiumPercent,
                DiscountPercent:req.body.DiscountPercent,
                DiscountPrice:req.body.DiscountPrice,
            },{ method:'update'}).then( e=>{
                Orders.forge({
                    Units:req.body.Unit,
                    Leads:req.body.Leads.ID
                }).save().then(async e=>{
                    try {
                        if (req.body.Contacts.length > 0) {
                            for (let i in req.body.Contacts) {
                                await OrderUsers.forge({
                                    Order: e.get('ID'),
                                    TypeID: req.body.Contacts[i].ID,
                                    Type: 'contact'
                                }).save()
                            }

                        }

                        if (req.body.Company.length > 0) {
                            for (let i in req.body.Company) {
                                await OrderUsers.forge({
                                    Order: e.get('ID'),
                                    TypeID: req.body.Company[i].ID,
                                    Type: 'company'
                                }).save()
                            }
                        }

                        if (req.body.PaymentList.length > 0) {
                            for (let i in req.body.PaymentList) {
                                await OrderPaymentPlan.forge({
                                    Order: e.get('ID'),
                                    Name:req.body.PaymentList[i].Name,
                                    PaymentPrice: req.body.PaymentList[i].PaymentPrice,
                                    PaymentDate: req.body.PaymentList[i].PaymentDate,
                                    Status:'pending',
                                    PaymentPlanDescription:req.body.PaymentList[i].Description
                                }).save()
                            }
                        }
                        return res.status(200).json({});
                    }catch (e) {
                        return res.status(404).json({
                            message:[
                                {
                                    msg: 'An unexpected error has occurred, please try again!1'
                                },
                            ]
                        });
                    }

                }).catch(() => {
                    return res.status(404).json({
                        message:[
                            {
                                msg: 'An unexpected error has occurred, please try again!2'
                            },
                        ]
                    });
                })

            }).catch(() => {
                return res.status(404).json({
                    message:[
                        {
                            msg: 'An unexpected error has occurred, please try again!3'
                        },
                    ]
                });
            })

        }).catch(e => {
            return res.status(404).json({
                message:[
                    {
                        msg: 'An unexpected error has occurred, please try again!4'
                    },
                ]
            });
        })

    }).catch(() => {
        UnitPrice.forge({
            Unit:req.body.Unit,
            BasePrice:req.body.BasePrice,
            Premium:req.body.PremiumPrice,
            PremiumPercent:req.body.PremiumPercent,
            DiscountPercent:req.body.DiscountPercent,
            DiscountPrice:req.body.DiscountPrice,
            PriceOnApplication:'no',
            Negotiable:'no',
        }).save().then( e=>{
          Orders.forge({
              Units:req.body.Unit,
              Leads:req.body.Leads.ID
          }).save().then(async e=>{
              try {
                  if (req.body.Contacts.length > 0) {
                      for (let i in req.body.Contacts) {
                          await OrderUsers.forge({
                              Order: e.get('ID'),
                              TypeID: req.body.Contacts[i].ID,
                              Type: 'contact'
                          }).save()
                      }

                  }

                  if (req.body.Company.length > 0) {
                      for (let i in req.body.Company) {
                          await OrderUsers.forge({
                              Order: e.get('ID'),
                              TypeID: req.body.Company[i].ID,
                              Type: 'company'
                          }).save()
                      }
                  }

                  if (req.body.PaymentList.length > 0) {
                      for (let i in req.body.PaymentList) {
                          await OrderPaymentPlan.forge({
                              Order: e.get('ID'),
                              Name:req.body.PaymentList[i].Name,
                              PaymentPrice: req.body.PaymentList[i].PaymentPrice,
                              PaymentDate: req.body.PaymentList[i].PaymentDate,
                              Status:'pending',
                              PaymentPlanDescription:req.body.PaymentList[i].Description
                          }).save()
                      }
                  }
                  return res.status(200).json({});
              }catch (e) {

                  return res.status(404).json({
                      message:[
                          {
                              msg: 'An unexpected error has occurred, please try again!'
                          },
                      ]
                  });
              }



          }).catch((e) => {
              return res.status(404).json({
                  message:[
                      {
                          msg: 'An unexpected error has occurred, please try again!'
                      },
                  ]
              });
          })

        }).catch((e) => {
            console.log(e);
            return res.status(404).json({
                message:[
                    {
                        msg: 'An unexpected error has occurred, please try again!'
                    },
                ]
            });
        })
    })




})

module.exports = router;
