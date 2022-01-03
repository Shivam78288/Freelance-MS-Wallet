require('dotenv').config;
const Token = artifacts.require("Token.sol");
const Wallet = artifacts.require("Wallet.sol")
const approvers = [process.env.ADDRESS1, process.env.ADDRESS2, process.env.ADDRESS3];

module.exports = function (deployer, network) {
    if(network === "rinkeby"){
        deployer.deploy(Token);
        deployer.deploy(Wallet, 2, approvers);
    }
};
