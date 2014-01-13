var MiniPh = require('./index.js');

var miniPh = new MiniPh('/dev/i2c-0', 0x4d);

function test() {
	miniPh.readPh(function (err, m) {
		if (err) {
			console.log(err);
		} else {
			console.log({
				raw : m.raw,
				pH : m.ph,
				filter: m.filter
			});
		}
	});
}

console.log(MiniPh.params);
miniPh.calcpHSlope();
console.log(MiniPh.params);
miniPh.saveConfig();
setInterval(test, 100);
