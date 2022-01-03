const { expectRevert } = require("@openzeppelin/test-helpers");
const {web3} = require("@openzeppelin/test-helpers/src/setup");
const Wallet = artifacts.require('Wallet.sol');
const Token = artifacts.require('Token.sol');

contract('Wallet',(accounts) => {
    let wallet, token;
    beforeEach(async() => {
        wallet = await Wallet.new(3, [accounts[0], accounts[1], accounts[2], accounts[3]]);
        token = await Token.new();
        await Promise.all(
            [accounts[0], accounts[1], accounts[2]]
                .map(account => token.faucet(
                                        account, 
                                        web3.utils.toWei('1000')
                                        )
                    )
        );
    });

    it("Should have correct number of approvers and quorum", async() => {
        const approvers = await wallet.getApprovers();
        const quorum = await wallet.quorum();
        const isApprover = await wallet.isApprover(accounts[0]);
        assert(quorum.toNumber() === 3);
        assert(approvers.length === 4);
        assert(approvers[0] === accounts[0]);
        assert(approvers[1] === accounts[1]);
        assert(approvers[2] === accounts[2]);
        assert(approvers[3] === accounts[3]);
        assert(isApprover === true);
    });

    it("Should log correct Eth and Token balances", async() => {
        await web3.eth.sendTransaction({
            from: accounts[0], 
            to: wallet.address, 
            value: web3.utils.toWei('1')
        });
        const amount = web3.utils.toWei('100');
        await token.approve(wallet.address, amount, {from: accounts[0]});
        await wallet.deposit(token.address, amount, {from: accounts[0]});
        const ethBal = await wallet.getEthBalance();
        const tokenBal = await wallet.getTokenBalance(token.address);
        assert(ethBal.toString() === web3.utils.toWei('1'));
        assert(tokenBal.toString() === amount);
    });

    it("Should create Eth Transfer", async()=>{
        //Providing some ETH to the wallet first
        await web3.eth.sendTransaction({
            from: accounts[0], 
            to: wallet.address, 
            value: web3.utils.toWei('1')
        });
        const amount = web3.utils.toWei("1");
        await wallet.createEthTransfer(accounts[3], amount, {from: accounts[0]});
        const transfers = await wallet.getTransfers();
        assert(transfers.length === 1);
        assert(transfers[0].noOfApprovals === '1');
        assert(transfers[0].sent === false);
    });
    
    it("Should create Token transfer", async() => {
        //Depositing some tokens first into the wallet
        await token.approve(wallet.address, web3.utils.toWei('50'), {from: accounts[0]});
        await wallet.deposit(token.address, web3.utils.toWei('50'), {from: accounts[0]});
        await wallet.createTokenTransfer(
            token.address,
            accounts[3],
            web3.utils.toWei('50')
        );
        const transfers = await wallet.getTransfers();
        assert(transfers.length === 1);
        assert(transfers[0].noOfApprovals === '1');
        assert(transfers[0].sent === false);
    });

    it("Should not create Token transfer if msg sender is not approver", async()=>{
        //Depositing some tokens first into the wallet
        const amount = web3.utils.toWei('50');
        await token.approve(wallet.address, amount, {from: accounts[0]});
        await wallet.deposit(token.address, amount, {from: accounts[0]});
        await expectRevert(
            wallet.createTokenTransfer(token.address, accounts[1], amount,{from: accounts[4]}),
            "Only approver can call this function"
        );
    });

    it("Should not create Eth transfer if msg sender is not approver", async()=>{
        //Depositing some Eth first into the wallet
        const amount = web3.utils.toWei('50');
        await web3.eth.sendTransaction({
            from: accounts[0], 
            to: wallet.address, 
            value: amount
        });
        await expectRevert(
            wallet.createEthTransfer(accounts[1], amount,{from: accounts[4]}),
            "Only approver can call this function"
        );
    });

    it("Should not create Eth transfer if amount is insufficient in wallet", async()=>{
        await web3.eth.sendTransaction({
            from: accounts[0], 
            to: wallet.address, 
            value: web3.utils.toWei('10')
        });
        const amount = web3.utils.toWei('50');
        await expectRevert(
            wallet.createEthTransfer(accounts[1], amount,{from: accounts[0]}),
            "Insufficient Eth balance in the contract"
        );
    });

    it("Should not create token transfer if amount is insufficient in wallet", async()=>{
        //Depositing some tokens first into the wallet
        const amount = web3.utils.toWei('50');
        await token.approve(wallet.address, amount, {from: accounts[0]});
        await wallet.deposit(token.address, amount, {from: accounts[0]});
        const withdrawAmount = web3.utils.toWei('100');
        await expectRevert(
            wallet.createTokenTransfer(token.address, accounts[1], withdrawAmount,{from: accounts[0]}),
            "Insufficient amount of tokens in the wallet"
            );
    });

    it("Should approve transfer", async() => {
        //Providing some ETH to the wallet first
        await web3.eth.sendTransaction({
            from: accounts[0], 
            to: wallet.address, 
            value: web3.utils.toWei('10')
        });
        const amount = web3.utils.toWei("5");
        await wallet.createEthTransfer(accounts[3], amount, {from: accounts[0]});
        let transfers = await wallet.getTransfers();
        await wallet.approveTransfer(transfers[0].id, {from: accounts[1]});
        transfers = await wallet.getTransfers();
        const approver1 = await wallet.approved(accounts[0], transfers[0].id);
        const approver2 = await wallet.approved(accounts[1], transfers[0].id);
        const approver3 = await wallet.approved(accounts[2], transfers[0].id);
        const approver4 = await wallet.approved(accounts[3], transfers[0].id);
        assert(transfers[0].sent === false);
        assert(transfers[0].noOfApprovals === '2');
        assert(approver1 === true);
        assert(approver2 === true);
        assert(approver3 === false);
        assert(approver4 === false);
    });
    
    it("Should not approve if not an approver", async()=>{
        //Providing some ETH to the wallet first
        await web3.eth.sendTransaction({
            from: accounts[0], 
            to: wallet.address, 
            value: web3.utils.toWei('10')
        });
        const amount = web3.utils.toWei("5");
        await wallet.createEthTransfer(accounts[3], amount, {from: accounts[0]});
        let transfers = await wallet.getTransfers();
        await expectRevert(
            wallet.approveTransfer(transfers[0].id, {from: accounts[5]}),
            "Only approver can call this function"
        );
    });

    it("Should not approve if already approved", async()=>{
        //Providing some ETH to the wallet first
        await web3.eth.sendTransaction({
            from: accounts[0], 
            to: wallet.address, 
            value: web3.utils.toWei('10')
        });
        const amount = web3.utils.toWei("5");
        await wallet.createEthTransfer(accounts[3], amount, {from: accounts[0]});
        let transfers = await wallet.getTransfers();
        await expectRevert(
            wallet.approveTransfer(transfers[0].id, {from: accounts[0]}),
            "Already approved by you"
        );
    });

    it("Should not send transfer if already sent", async()=>{
        //Providing some ETH to the wallet first
        await web3.eth.sendTransaction({
            from: accounts[0], 
            to: wallet.address, 
            value: web3.utils.toWei('10')
        });
        const amount = web3.utils.toWei("5");
        await wallet.createEthTransfer(accounts[3], amount, {from: accounts[0]});
        let transfers = await wallet.getTransfers();
        await wallet.approveTransfer(transfers[0].id, {from: accounts[1]});
        await wallet.approveTransfer(transfers[0].id, {from: accounts[2]});
        transfers = await wallet.getTransfers();
        await expectRevert(
            wallet.approveTransfer(transfers[0].id, {from: accounts[3]}),
            "Transfer already sent"
        );
    });

    it("Should send Eth transfer if quroum fulfilled", async() =>{
        await web3.eth.sendTransaction({
            from: accounts[0], 
            to: wallet.address, 
            value: web3.utils.toWei('10')
        });
        const balBefore = web3.utils.toBN(await wallet.getEthBalance());
        const amount = web3.utils.toWei("5");
        await wallet.createEthTransfer(accounts[3], amount, {from: accounts[0]});
        let transfers = await wallet.getTransfers();
        await wallet.approveTransfer(transfers[0].id, {from: accounts[1]});
        await wallet.approveTransfer(transfers[0].id, {from: accounts[2]});
        transfers = await wallet.getTransfers();
        const balNow = web3.utils.toBN(await wallet.getEthBalance());
        assert(transfers[0].sent === true);
        assert(balBefore.sub(balNow).toString() === amount);
    
    });

    it("Should send token transfer if quorum fulfilled", async() => {
        //Depositing some tokens first into the wallet
        
        await token.approve(wallet.address, web3.utils.toWei('50'), {from: accounts[0]});
        await wallet.deposit(token.address, web3.utils.toWei('50'), {from: accounts[0]});
        const balBefore = web3.utils.toBN(await wallet.getTokenBalance(token.address));
        const amount = web3.utils.toWei("20");
        await wallet.createTokenTransfer(
            token.address,
            accounts[3],
            amount
        );
        let transfers = await wallet.getTransfers();
        await wallet.approveTransfer(transfers[0].id, {from: accounts[1]});
        await wallet.approveTransfer(transfers[0].id, {from: accounts[2]});
        transfers = await wallet.getTransfers();
        const balNow = web3.utils.toBN(await wallet.getTokenBalance(token.address));
        assert(transfers[0].sent === true);
        assert(balBefore.sub(balNow).toString() === amount);

    });
    
});