module.exports = async function(ethereum, req, callback) {
    const accounts = ethereum.getAccounts();
    callback(undefined, Array.from(accounts));
}
