// Authors: Jeff Kephart (kephart@us.ibm.com)

const fs = require('fs');
const http = require('http');
const express = require('express');
let methodOverride = require('method-override');
let bodyParser = require('body-parser');

const appSettings = require('./appSettings.json');
let loggerModule = appSettings.logger || '@cisl/logger';
const { logExpression, setLogLevel } = require(loggerModule);

let logLevel = 1;
process.argv.forEach((val, index, array) => {
	if (val === '-port') {
		myPort = array[index + 1];
	}
	if (val === '-level') {
		logLevel = array[index + 1];
		logExpression('Setting log level to ' + logLevel, 1);
	}
});

setLogLevel(logLevel);

let myPort = appSettings.defaultPort || 7021;

const app = express();

app.use(express.json());

app.set('port', process.env.PORT || myPort);
app.set('json spaces', 2);
app.use(
  express.json({
    limit: '50mb',
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: '50mb',
  })
);

let recipe = require('./recipe.json');
let sellerUtilityDistributionParameters = require('./sellerUtilityDistributionParameters.json');
let buyerUtilityDistributionParameters = require('./buyerUtilityDistributionParameters.json');


let testPostSeller = require('./testUtilitySeller.json');


// Purpose: Generate a utility for a seller or buyer by drawing from the buyer/seller utility
// function distribution.
app.get('/generateUtility/:agentRole', (req, res) => {
  let agentRole = req.params.agentRole;
  logExpression("/generateUtility/" + agentRole + " called.", 2);
  if(agentRole.toLowerCase() == "human") agentRole ="buyer";
  if(agentRole.toLowerCase() == "agent") agentRole ="seller";
  if(agentRole.toLowerCase() == "buyer") {
    res.json(instantiateDistribution(null, buyerUtilityDistributionParameters));
  }
  else if (agentRole.toLowerCase() == "seller") {
    res.json(instantiateDistribution(null, sellerUtilityDistributionParameters));
  }
  else res.send(500,{"msg": "Invalid agent role: " + agentRole});
});

// Purpose: Calculate utility for an agent or a human, given their utility function and the set of goods
// that they sold or acquired. This can be used by an agent during a round to determine how profitable a
// given bid would be. However, it can only be used by a human after the round is complete and they have
// determined this allocation from the set of ingredients, as the human allocation is in terms of baked
// products rather than raw goods.

//Example input to POST to calculateUtility:
//{
//   "currencyUnit":"USD",
//   "utility":{
//      "cake":{
//         "type":"unitvaluePlusSupplement",
//         "unit":"each",
//         "parameters":{
//            "unitvalue":25,
//            "supplement":{
//               "chocolate":{
//                  "type":"trapezoid",
//                  "unit":"ounce",
//                  "parameters":{
//                     "minQuantity":3,
//                     "maxQuantity":6,
//                     "minValue":3,
//                     "maxValue":6
//                  }
//               },
//               "vanilla":{
//                  "type":"trapezoid",
//                  "unit":"teaspoon",
//                  "parameters":{
//                     "minQuantity":2,
//                     "maxQuantity":4,
//                     "minValue":2,
//                     "maxValue":4
//                  }
//               }
//            }
//         }
//      },
//      "pancake":{
//         "type":"unitvaluePlusSupplement",
//         "unit":"each",
//         "parameters":{
//            "unitvalue":10,
//            "supplement":{
//               "chocolate":{
//                  "type":"trapezoid",
//                  "unit":"ounce",
//                  "parameters":{
//                     "minQuantity":3,
//                     "maxQuantity":6,
//                     "minValue":3,
//                     "maxValue":6
//                  }
//               },
//               "blueberry":{
//                  "type":"trapezoid",
//                  "unit":"packet",
//                  "parameters":{
//                     "minQuantity":1,
//                     "maxQuantity":3,
//                     "minValue":1,
//                     "maxValue":3
//                  }
//               }
//            }
//         }
//      }
//   },
//   "bundle":{
//      "cost":20,
//      "products":{
//         "cake":{
//            "unit": "each",
//            "quantity":3,
//            "supplement":[
//               {
//                  "chocolate":{
//                     "unit":"ounce",
//                     "quantity":2
//                  },
//                  "vanilla":{
//                     "unit":"teaspoon",
//                     "quantity":2
//                  }
//               },
//               {
//                  "chocolate":{
//                     "unit":"ounce",
//                     "quantity":3
//                  }
//               },
//               {
//                  "vanilla":{
//                     "unit":"teaspoon",
//                     "quantity":1
//                  }
//               }
//            ]
//         },
//         "pancake":{
//            "unit": "each",
//            "quantity":2,
//            "supplement":[
//               {
//                  "blueberry":{
//                     "unit":"packet",
//                     "quantity":2
//                  }
//               },
//               {
//
//               }
//            ]
//         }
//      }
//   }
//}

app.post('/calculateUtility/:agentRole', (req, res) => {
  let agentRole = req.params.agentRole;
  let data = req.body;
  if(agentRole.toLowerCase() == "human") agentRole = "buyer";
  if(agentRole.toLowerCase() == "agent") agentRole = "seller";
  if(agentRole.toLowerCase() == "buyer") {
    let utilityInfo = calculateUtilityBuyer(data.utility, data.bundle);
    res.json({
      "currencyUnit": data.currencyUnit,
      "value": utilityInfo.utility,
      "breakdown": utilityInfo.breakdown
    });
  }
  else if (agentRole.toLowerCase() == "seller") {
    let util = calculateUtilitySeller(data.utility, data.bundle);
    res.json({
      "currencyUnit": data.currencyUnit,
      "value": util
    });
  }
  else {
    res.send(500,{"msg": "Invalid role: " + agentRole});
  }
});

//// Purpose: Calculate utility for a buyer or seller, given their utility function and the set of goods
//// that they sold or acquired. This can be used by an agent during a round to determine how profitable a
//// given bid would be. However, it can only be used by a human after the round is complete and they have
//// determined this allocation from the set of ingredients, as the human allocation is in terms of baked
//// products rather than raw goods.
//app.get('/calculateUtility/:agentType', (req, res) => {
//  let agentType = req.params.agentType;
//  if(agentType.toLowerCase() == "human") {
//    let data = testProductHuman;
//    let utilityInfo = calculateUtilityHuman(data.utility, data.allocation);
//    res.json({
//      "currencyUnit": data.currencyUnit,
//      "value": utilityInfo.utility,
//      "breakdown": utilityInfo.breakdown
//    });
//  }
//  else if (agentType.toLowerCase() == "agent") {
//    let data = testPostAgent;
//    let util = calculateUtilityAgent(data.utility, data.bundle);
//    res.json({
//      "currencyUnit": data.currencyUnit,
//      "value": util
//    });
//  }
//  else {
//    res.send(500,{"msg": "Invalid agent type: " + agentType});
//  }
//});


// Purpose: Check whether a given set of ingredients is sufficient to create a given allocation of ingredients
// into products, given the recipe. If it is not sufficient, a rationale is provided, which explains which
// ingredients are insufficient, and the amount of the shortfall.

//Example input to POST to checkAllocation: {
//   "allocation":{
//      "cost":20,
//      "products":{
//         "cake":{
//            "unit": "each",
//            "quantity":3,
//            "supplement":[
//               {
//                  "chocolate":{
//                     "unit":"ounce",
//                     "quantity":2
//                  },
//                  "vanilla":{
//                     "unit":"teaspoon",
//                     "quantity":2
//                  }
//               },
//               {
//                  "chocolate":{
//                     "unit":"ounce",
//                     "quantity":3
//                  }
//               },
//               {
//                  "vanilla":{
//                     "unit":"teaspoon",
//                     "quantity":1
//                  }
//               }
//            ]
//         },
//         "pancake":{
//            "unit": "each",
//            "quantity":2,
//            "supplement":[
//               {
//                  "blueberry":{
//                     "unit":"packet",
//                     "quantity":2
//                  }
//               },
//               {
//
//               }
//            ]
//         }
//      }
//   },
//   "ingredients": {
//      "egg": 3,
//      "flour": 3,
//      "milk": 3,
//      "sugar": 4,
//      "chocolate": 6,
//      "vanilla": 2,
//      "blueberry": 2
//   }
//}

// Purpose: Check whether a given set of ingredients is sufficient to create a given allocation of ingredients
// into products, given the recipe. If it is not sufficient, a rationale is provided, which explains which
// ingredients are insufficient, and the amount of the shortfall.
app.post('/checkAllocation', (req, res) => {
  let data = req.body;
  let sufficiency = checkIngredients(data.ingredients, data.allocation, recipe);
  logExpression(sufficiency, 2);
  let ret = {
    "ingredients": data.ingredients,
    "allocation": data.allocation,
    "sufficient": sufficiency.sufficient
  };
  //if(!sufficiency.sufficient) ret.rationale = sufficiency.rationale;
  if (sufficiency.rationale) {
    ret.rationale = sufficiency.rationale;
  }
  res.json(ret);
});

app.get('/checkAllocation', (req, res) => {
  let data = JSON.parse(fs.readFileSync('./testProductBuyer.json', 'utf8'));
  let sufficiency = checkIngredients(data.ingredients, data.allocation, recipe);
  logExpression(sufficiency, 2);
  let ret = {
    "ingredients": data.ingredients,
    "allocation": data.allocation,
    "sufficient": sufficiency.sufficient
  };
  if(!sufficiency.sufficient) ret.rationale = sufficiency.rationale;
  res.json(ret);
});

//app.get('/optimizeIngredients', (req, res) => {
//  let data = testProductHuman;
//  let max = optimizeIngredients(data.ingredients, recipe, data.utility);
//  logExpression(max, 2);
//  res.json({
//      "max": max,
//      "ingredients": data.ingredients,
//      "recipe": recipe
//  });
//});

app.get('/setLogLevel/:logLevel', (req, res) => {
	const newLogLevel = req.params.logLevel;
	setLogLevel(newLogLevel);
	logExpression('Setting log level to ' + newLogLevel, 2);
	res.json({
		msg: 'Set log level to ' + newLogLevel,
	});
});

const server = http.createServer(app);
server.listen(app.get('port'), () => {
  logExpression('Express server listening on port ' + app.get('port'), 1);
});

function instantiateDistribution(field, obj) {
  if(Array.isArray(obj) && obj.length == 2) {
    let range = obj;
    let draw = range[0] + Math.random() *  (range[1] - range[0]);
    let ndecimals = (field && field.includes('Quantity')) ? 0 : 2;
    return quantize(draw, ndecimals);
  }
  else if (Object.keys(obj).length) {
    let newobj = {};
    Object.keys(obj).forEach(field => {
      if(typeof obj[field] == 'string') {
        newobj[field] = obj[field];
      }
      else {
        if(field == "distribution") {
          newobj.utility = instantiateDistribution(field, obj[field]);
        }
        else {
          newobj[field] = instantiateDistribution(field, obj[field]);
        }
      }
    });
    return newobj;
  }
}

function quantize(quantity, decimals) {
  let multiplicator = Math.pow(10, decimals);
  q = parseFloat((quantity * multiplicator).toFixed(11));
  return Math.round(q) / multiplicator;
}

function calculateUtilitySeller(utilityParams, bundle) {
  let util = bundle.price;
  Object.keys(bundle.quantity).forEach(good => {
    util -= utilityParams[good].parameters.unitcost * bundle.quantity[good];
  });
  return util;
}

function calculateUtilityBuyer(utility, allocation) {
  logExpression("In calculateUH with utility and allocation = ", 2);
  logExpression(utility, 2);
  logExpression(allocation, 2);
  let util = 0;
  let breakdown = {};
  Object.keys(allocation.products).forEach(good => {
    logExpression(utility[good].parameters, 2);
    logExpression(allocation.products[good], 2);
    let incUtil = utility[good].parameters.unitvalue * allocation.products[good].quantity;
    util += incUtil;
    breakdown[good] = {
      quantity: allocation.products[good].quantity,
      utility: incUtil,
    };

    logExpression("Now util is: " + util, 2);
    if(allocation.products[good].supplement) {
      breakdown[good].supplement = [];
      let uParams= utility[good].parameters.supplement;
      let supplementList = allocation.products[good].supplement;
      logExpression("supplementList: ", 2);
      logExpression(supplementList, 2);
      supplementList.forEach(sBlock => {
        let maxExtras = 1;
        let extras = 0;
        Object.keys(sBlock).forEach(sgood => {
          let sQuantity = Math.min(sBlock[sgood].quantity, uParams[sgood].parameters.maxQuantity);
          if(sQuantity < sBlock[sgood].quantity) sQuantity = 0;
          let eUtil = uParams[sgood].parameters.minValue + (sQuantity - uParams[sgood].parameters.minQuantity) * (uParams[sgood].parameters.maxValue - uParams[sgood].parameters.minValue) / (uParams[sgood].parameters.maxQuantity - uParams[sgood].parameters.minQuantity);
          if(extras < maxExtras) {
            util += eUtil;
            logExpression("Added extra utility " + eUtil + " for " + sQuantity + " " + sgood + ".", 2);
            logExpression("Now util is:  " + util, 2);
            extras++;
            breakdown[good].supplement.push({good: sgood, quantity: sQuantity, utility: eUtil});
          }
          else {
            logExpression("Attempted to add another extra (" + sgood + "), but maximum extras is " + maxExtras, 2);
          }
        });
      });
    }
  });
  logExpression("Finally, util is: " + util, 2);
  return {
    utility: util,
    breakdown: breakdown
  };
}

function checkIngredients(ingredients, allocation, recipe) {
  let sufficient = true;
  let requiredIngredients = {};
  let products = allocation.products;
  let rationale = {};
  Object.keys(products).forEach(good => {
    Object.keys(recipe[good]).forEach(cgood => {
      logExpression("good: " + good + ", cgood: " + cgood, 3);
      logExpression(recipe[good][cgood], 3);
      logExpression(products[good].quantity, 3);
      if(!requiredIngredients[cgood]) {
        requiredIngredients[cgood] = 0;
      }
      requiredIngredients[cgood] += recipe[good][cgood] * products[good].quantity;
      logExpression("requiredIngredients[" + cgood + "] = ", 3);
      logExpression(requiredIngredients[cgood], 3);
    });
    if(products[good].supplement) {
      products[good].supplement.forEach(sBlock => {
        Object.keys(sBlock).forEach(sgood => {
          if(requiredIngredients[sgood] == null || requiredIngredients[sgood] == undefined) {
            requiredIngredients[sgood] = 0;
          }
          requiredIngredients[sgood] += sBlock[sgood].quantity;
        });
      });
    }
  });
  logExpression("requiredIngredients: ", 3);
  logExpression(requiredIngredients, 3);
  Object.keys(ingredients).forEach(good => {
    logExpression("requiredIngredients[" +  good + "]: ", 2);
    logExpression(requiredIngredients[good], 3);
    let enough = requiredIngredients[good] == null || requiredIngredients[good] == undefined;
    logExpression("Enough is: " + enough, 3);
    enough = enough || (requiredIngredients[good] <= ingredients[good]);
    logExpression("Now enough is: " + enough, 3);
    if(!enough) {
      logExpression("Not enough " + good, 3);
      logExpression("Need: " + requiredIngredients[good] + " but only have " + ingredients[good] + ".", 2);
    }
    rationale[good] = {"need": requiredIngredients[good] || 0, "have": ingredients[good] || 0};
    sufficient = sufficient && enough;
  });
  logExpression("returning sufficient value of " + sufficient, 2);
  return {
    sufficient,
    rationale
  };
}

// Functions after this don't work right -- maybe we'll get back to them later
function optimizeIngredients(ingredients, recipe, utility) { // Generate optimal allocation
  let max = {};
  Object.keys(recipe).forEach(good => {
    max[good] = null;
    logExpression("In optimizeIngredients, good is: " + good, 2);
    Object.keys(recipe[good]).forEach(cgood => {
      logExpression("cgood: " + cgood, 2);
      logExpression(ingredients[cgood], 2);
      logExpression(recipe[good][cgood], 2);
      let m = parseInt(ingredients[cgood]/recipe[good][cgood]);
      logExpression(m, 2);
      if(!max[good] || (m < max[good])) max[good] = m;
    });
  });
  logExpression("max of each good is: ", 2);
  logExpression(max, 2);
  let g = [];
  Object.keys(max).forEach((good,i) => {
    g[i] = good;
  });
  let alloc = {
    "products": {}
  };
  logExpression("Maxes: ", 2);
  logExpression(max[g[0]], 2);
  logExpression(max[g[1]], 2);
  for(let i = 0; i <= max[g[0]]; i++) {
    alloc.products[g[0]] = {
      "unit": "each",
      "quantity": i
    };
    for(let j = 0; j <= max[g[1]]; j++) {
      alloc.products[g[1]] = {
        "unit": "each",
        "quantity": j
      };
      logExpression("allocation is currently: ", 2);
      logExpression(alloc, 2);
      let sufficiency = checkIngredients(ingredients, alloc, recipe);
      logExpression("checkIngredients result: " + sufficiency.sufficient, 2);
      if(sufficiency.sufficient) {
        let optimalSupplement = optimizeSupplement(ingredients, alloc, recipe, utility);
        logExpression("optimalSupplement: ", 2);
        logExpression(optimalSupplement, 2);
      }
    }
  }
  return max;
}

function optimizeSupplement(ingredients, allocation, recipe, utility) {
  logExpression("In optimizeSupplement with ingredients, allocation, recipe and utility = ", 2);
  logExpression(ingredients, 2);
  logExpression(allocation, 2);
  logExpression(recipe, 2);
  logExpression(utility, 2);
  let util = 0;
  Object.keys(allocation.products).forEach(good => {
    logExpression(utility[good].parameters, 2);
    logExpression(allocation.products[good], 2);

    util += utility[good].parameters.unitvalue * allocation.products[good].quantity;
    logExpression("Now util is: " + util, 2);
    let extraUtil = 0;
    if(utility[good].parameters.supplement) {
      logExpression("Calculating supplement for " + good + ".", 2);
      let uParams = utility[good].parameters.supplement;
      logExpression(uParams, 2);
      Object.keys(uParams).forEach(sgood => { // sgood is e.g. chocolate or blueberry
        let sgoodParams = uParams[sgood].parameters;
        let maxNumGoodsSupplemented = parseInt(ingredients[sgood]/sgoodParams.minQuantity);
        let minNumGoodsSupplemented = parseInt(ingredients[sgood]/sgoodParams.maxQuantity);
        for (let s = minNumGoodsSupplemented; s <= maxNumGoodsSupplemented; s++) {
          let minSupplementalAmount = parseInt(ingredients[sgood]/s);
        }
        logExpression("max[" + sgood + "]  = " + max[sgood], 2);
        let eUtil = 0;
        logExpression("supplemental good: " + sgood, 2);
        logExpression("Number of " + good + ": " + allocation.products[good].quantity, 2);
        logExpression("Quantity of supplemental good " + sgood + ": " + ingredients[sgood], 2);
        let numSupplemented = parseInt(allocation.products[good].quantity/uParams[sgood].parameters.minQuantity);
        numSupplemented = Math.min(numSupplemented, allocation.products[good].quantity);
        logExpression("Number of supplemented " + good + ": " + numSupplemented, 2);
        let avgsQuantity = ingredients[sgood] / parseFloat(numSupplemented);
        logExpression("Average quantity of " + sgood + " per " + good + ": " + avgsQuantity, 2);
        if(avgsQuantity >= uParams[sgood].parameters.minQuantity) {
          let usefulQuantity = Math.min(avgsQuantity, uParams[sgood].parameters.maxQuantity);
          logExpression("usefulQuantity of " + sgood + ": " + usefulQuantity, 2);
          eUtil = uParams[sgood].parameters.minValue + (usefulQuantity - uParams[sgood].parameters.minQuantity) * (uParams[sgood].parameters.maxValue - uParams[sgood].parameters.minValue) / (uParams[sgood].parameters.maxQuantity - uParams[sgood].parameters.minQuantity);
          eUtil *= numSupplemented;
          if(eUtil > extraUtil) {
            extraUtil = eUtil;
          }
          logExpression("extraUtil is now: " + extraUtil, 2);
        }
      });
      util += extraUtil;
    }
  });
  logExpression("Finally, util is: " + util, 2);
  return util;
}
