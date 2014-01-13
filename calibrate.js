var MiniPh = require('./index.js');
var miniPh = new MiniPh('/dev/i2c-0', 0x4d);

function read() {
	miniPh.readPh(function (err, m) {
		if (err) {
			console.log(err);
		}
	});
}

function display() {
	console.log({
		raw : miniPh.raw,
		filter : miniPh.filter,
		pH : miniPh.ph

	});
}

//show loaded config
console.log(MiniPh.params);
// read 10 times a second
setInterval(read, 100);
// display once a second
setInterval(display, 1000);

console.log('Commands - Return key after each');
console.log('Put probe in solution and wait for raw numbers to stablise');
console.log('h set high pH set point');
console.log('l set low pH set point');
console.log('s save config');
console.log('v view config');
console.log('c clear last value when changing test solution');
console.log('x exit');

var stdin = process.stdin;
stdin.resume();
stdin.setEncoding('utf8');

// Read commands from console
stdin.on('data', function (key) {
	if (key == 'x\n')
		process.exit();
	if (key == 'h\n') {
		console.log('Setting high point for pH' + MiniPh.params.pHCalHighSolution + ' to ' + miniPh.filter);
		miniPh.calibratepHHigh(miniPh.filter);
	}
	if (key == 'l\n') {
		console.log('Setting low point for pH' + MiniPh.params.pHCalLowSolution + ' to ' + miniPh.filter);
		miniPh.calibratepHLow(miniPh.filter);
	}
	if (key == 'c\n') {
		console.log('Changed Solution, filter reset');
		miniPh.resetFilter();
	}
	if (key == 's\n') {
		console.log('Saving Config..');
		miniPh.saveConfig();
		console.log('Saved');
	}
	if (key == 'v\n') {
		console.log('current Config..');
		console.log(MiniPh.params);
	}
});
