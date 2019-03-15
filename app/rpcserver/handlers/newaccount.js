module.exports = async function(ethereum, req, callback) {
    const address = ethereum.newAccount();
    callback(undefined, address);
}
