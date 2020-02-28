# utility-generator

## Usage

### GET /generateUtility/:agentType

Where `agentType` can be:

* human
* agent

### POST /calculateUtility/:agentType

Where `agentType` can be:

* human
* agent

and the body should be their generated utility function (from above) and the
quantity of items

### post /checkAllocation

Given a list of ingredients and the items one wishes to mix them into, determines
if the amount is sufficient and if not, gives an explanation of what is missing.

## Contributing

We are open to contributions.

* The software is provided under the [MIT license](LICENSE). Contributions to
this project are accepted under the same license.
* Please also ensure that each commit in the series has at least one
`Signed-off-by:` line, using your real name and email address. The names in
the `Signed-off-by:` and `Author:` lines must match. If anyone else
contributes to the commit, they must also add their own `Signed-off-by:`
line. By adding this line the contributor certifies the contribution is made
under the terms of the
[Developer Certificate of Origin (DCO)](DeveloperCertificateOfOrigin.txt).
* Questions, bug reports, et cetera are raised and discussed on the issues page.
* Please make merge requests into the master branch.
