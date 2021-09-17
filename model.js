// Step 3 - this is the code for ./models.js

var mongoose = require('mongoose');

var imageSchema = new mongoose.Schema({
	name: String,
    randomExpiry: Number,
    img:
	{
		data: Buffer,
		contentType: String
	}
});
//random expiry time/date

module.exports = new mongoose.model('Image', imageSchema);
