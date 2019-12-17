# anac-utility

## GET /generateUtility/:agentType

Where `agentType` can be:

* human
* agent

## POST /calculateUtility/:agentType

Where `agentType` can be:

* human
* agent

and the body should be their generated utility function (from above) and the
quantity of items

## post /checkAllocation

Given a list of ingredients and the items one wishes to mix them into, determines
if the amount is sufficient and if not, gives an explanation of what is missing.
