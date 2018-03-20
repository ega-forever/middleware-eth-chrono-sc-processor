module.exports = async (accountFrom, accountTo, contracts) => {
  return await contracts.UserManagerInstance.addCBE(
    accountTo, 0x0, {
      from: accountFrom,
      gas: 3000000
    });
};
