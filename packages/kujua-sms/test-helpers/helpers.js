exports.rand = function(from, to) {
    from = from || 10000000000;
    to = to || 99999999999;
    return Math.floor(Math.random() * (to - from + 1) + from);
};

exports.headers = function(type, data) {
    var types = {
        json: "application/json; charset=utf-8",
        url: "application/x-www-form-urlencoded"
    };
    
    return {
        "Content-Length": data.length,
        "Content-Type": types[type],
        "Host": window.location.host
    };
};