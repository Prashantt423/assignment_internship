const Bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
var express = require('express')
var app = express();
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var arr = [];
var fs = require('fs');
var path = require('path');
require('dotenv/config');
const {
	v1: uuidv1,
	v4: uuidv4,
} = require('uuid');


app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(express.static("public"));

mongoose.connect("mongodb+srv://admin-pk:pktk001@cluster0.w3dfu.mongodb.net/InternshipAssignment?retryWrites=true",
	{ useNewUrlParser: true, useUnifiedTopology: true }, err => {
		console.log('connected')
	});

var AWS = require('aws-sdk');

const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ID,
	secretAccessKey: process.env.AWS_SECRET
})
const ranDate = require('./randomDate');

// Set EJS as templating engine
app.set("view engine", "ejs");


//set up multer for storing uploaded files

var multer = require('multer');

var storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'uploads/active')
	},
	filename: (req, file, cb) => {
		cb(null, file.fieldname + '-' + Date.now())
	}
});

var upload = multer({ storage: storage });
// load the mongoose model for Image

var imgModel = require('./model');
var userSchema = new mongoose.Schema({
	name: String,
	email: { type: String, unique: true },
	isVerified: { type: Boolean, default: false },
	password: String,
})

var tokenSchema = new mongoose.Schema({
	_userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
	token: { type: String, required: true },
	expireAt: { type: Date, default: Date.now, index: { expires: 86400000 } }
});

var User = new mongoose.model('User', userSchema);
var token = new mongoose.model('Token', tokenSchema);

app.post("/login", function (req, res, next) {
	User.findOne({ email: req.body.email }, function (err, user) {
		// error occur
		if (err) {
			return res.status(500).send({ msg: err.message });
		}
		// user is not found in database i.e. user is not registered yet.
		else if (!user) {
			return res.status(401).send({ msg: 'The email address ' + req.body.email + ' is not associated with any account. please check and try again!' });
		}
		// comapre user's password if user is find in above step
		
		// else if (!Bcrypt.compareSync(req.body.password, user.password)) {
		// 	return res.status(401).send({ msg: 'Wrong Password!' });
		// }
		// check user is verified or not
		else if (!user.isVerified) {
			return res.status(401).send({ msg: 'Your Email has not been verified. Please click on resend' });
		}
		// user successfully logged in
		else {
			return res.status(200).send('User successfully logged in.');
		}
	});

});

app.post("/signup", function (req, res, next) {
	User.findOne({ email: req.body.email }, function (err, user) {
		// error occur
		if (err) {
			return res.status(500).send({ msg: err.message });
		}
		// if email is exist into database i.e. email is associated with another user.
		  else if (user) {
			  return res.status(400).send({msg:'This email address is already associated with another account.'});
		  }
		// if user is not exist into database then save the user into database for register account
		else {
			// password hashing for save into databse
			if (req.password)
				req.body.password = Bcrypt.hashSync(req.body.password, 10);

			// create and save user
			user = new User({ name: req.body.name, email: req.body.email, password: req.body.password });
			// User.dropIndex({ "email": 1 });
			// User.createIndex({ "email": 1 }, { sparse: true })
			user.save(function (err) {
				
				if (err) {
					return res.status(500).send({ msg: err.message });
				}

				// generate token and save
				var token = new Token({ _userId: user._id, token: crypto.randomBytes(16).toString('hex') });
				token.save(function (err) {
					if (err) {
						return res.status(500).send({ msg: err.message });
					}

					// Send email (use verified sender's email address & generated API_KEY on SendGrid)
					const transporter = nodemailer.createTransport(
						sendgridTransport({
							auth: {
								api_key: SG.uQIXsToSRZmyRHr9o3UJBg.m7arYbPZshVv6n4MBIG3ivDNzlsso9KwW6IrPHb3HO,
							}
						})
					)
					var mailOptions = { from: 'impktk.com', to: user.email, subject: 'Account Verification Link', text: 'Hello ' + req.body.name + ',\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nThank You!\n' };
					transporter.sendMail(mailOptions, function (err) {
						if (err) {
							return res.status(500).send({ msg: 'Technical Issue!, Please click on resend for verify your Email.' });
						}
						return res.status(200).send('A verification email has been sent to ' + user.email + '. It will be expire after one day. If you not get verification Email click on resend token.');
					});
				});
			});
		}

	});

});

app.get('/confirmation/:email/:token', function (req, res, next) {
	Token.findOne({ token: req.params.token }, function (err, token) {
		// token is not found into database i.e. token may have expired 
		if (!token) {
			return res.status(400).send({ msg: 'Your verification link may have expired. Please click on resend for verify your Email.' });
		}
		// if token is found then check valid user 
		else {
			User.findOne({ _id: token._userId, email: req.params.email }, function (err, user) {
				// not valid user
				if (!user) {
					return res.status(401).send({ msg: 'We were unable to find a user for this verification. Please SignUp!' });
				}
				// user is already verified
				else if (user.isVerified) {
					return res.status(200).send('User has been already verified. Please Login');
				}
				// verify user
				else {
					// change isVerified to true
					user.isVerified = true;
					user.save(function (err) {
						// error occur
						if (err) {
							return res.status(500).send({ msg: err.message });
						}
						// account successfully verified
						else {
							return res.status(200).send('Your account has been successfully verified');
						}
					});
				}
			});
		}

	});
});


app.post("/resendLink", function (req, res, next) {

	User.findOne({ email: req.body.email }, function (err, user) {
		// user is not found into database
		if (!user) {
			return res.status(400).send({ msg: 'We were unable to find a user with that email. Make sure your Email is correct!' });
		}
		// user has been already verified
		else if (user.isVerified) {
			return res.status(200).send('This account has been already verified. Please log in.');

		}
		// send verification link
		else {
			// generate token and save
			var token = new Token({ _userId: user._id, token: crypto.randomBytes(16).toString('hex') });
			token.save(function (err) {
				if (err) {
					return res.status(500).send({ msg: err.message });
				}

				// Send email (use verified sender's email address & generated API_KEY on SendGrid)
				const transporter = nodemailer.createTransport(
					sendgridTransport({
						auth: {
							api_key:
								SG.uQIXsToSRZmyRHr9o3UJBg.m7arYbPZshVv6n4MBIG3ivDNzlsso9KwW6IrPHb3HO,
						}
					})
				)
				var mailOptions = { from: 'impktk@gmail.com', to: user.email, subject: 'Account Verification Link', text: 'Hello ' + user.name + ',\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nThank You!\n' };
				transporter.sendMail(mailOptions, function (err) {
					if (err) {
						return res.status(500).send({ msg: 'Technical Issue!, Please click on resend for verify your Email.' });
					}
					return res.status(200).send('A verification email has been sent to ' + user.email + '. It will be expire after one day. If you not get verification Email click on resend token.');
				});
			});
		}
	});
});

app.post("/resendLink", function (req, res, next) {

	User.findOne({ email: req.body.email }, function (err, user) {
		// user is not found into database
		if (!user) {
			return res.status(400).send({ msg: 'We were unable to find a user with that email. Make sure your Email is correct!' });
		}
		// user has been already verified
		else if (user.isVerified) {
			return res.status(200).send('This account has been already verified. Please log in.');

		}
		// send verification link
		else {
			// generate token and save
			var token = new Token({ _userId: user._id, token: crypto.randomBytes(16).toString('hex') });
			token.save(function (err) {
				if (err) {
					return res.status(500).send({ msg: err.message });
				}

				// Send email (use verified sender's email address & generated API_KEY on SendGrid)
				const transporter = nodemailer.createTransport(
					sendgridTransport({
						auth: {
							api_key: process.env.SENDGRID_APIKEY,
						}
					})
				)
				var mailOptions = { from: 'no-reply@example.com', to: user.email, subject: 'Account Verification Link', text: 'Hello ' + user.name + ',\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/confirmation\/' + user.email + '\/' + token.token + '\n\nThank You!\n' };
				transporter.sendMail(mailOptions, function (err) {
					if (err) {
						return res.status(500).send({ msg: 'Technical Issue!, Please click on resend for verify your Email.' });
					}
					return res.status(200).send('A verification email has been sent to ' + user.email + '. It will be expire after one day. If you not get verification Email click on resend token.');
				});
			});
		}
	});
});



//  the GET request handler that provides the HTML UI

app.get('/update', (req, res) => {
	imgModel.find({}, (err, items) => {
		if (err) {
			console.log(err);
			res.status(500).send('An error occurred', err);
		}
		else {
			res.render('img', { items: items });
		}
	});
});
//  the POST handler for processing the uploaded file

app.post('/', upload.single('image'), (req, res, next) => {


	var obj = {
		name: req.body.name,
		randomExpiry: ranDate,
		img: {
			data: fs.readFileSync(path.join(__dirname + '/uploads/active/' + req.file.filename)),
			contentType: 'image/png'
		}

	}

	imgModel.create(obj, (err, item) => {
		if (err) {
			console.log(err);
		}
		else {

			async function upload(key, file) {

				const storage = new AWS.S3()

				try {
					const params = {
						Body: file.data,
						Key: key,
						ACL: 'public-read',
						Bucket: process.env.AWS_S3_BUCKET
					}

					return await storage.upload(params).promise()

				} catch (err) {
					throw new Error(`S3 upload error: ${err.message}`)
				}
			}
			res.redirect("/update");
		}
	});
});
// configure the server's port

var port = process.env.PORT || '3000'
app.listen(port, err => {
	if (err)
		throw err
	console.log('Server listening on port', port)
})

