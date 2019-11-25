var express = require('express');
var multer = require('multer');
var pathlib = require('path');
var fs = require('fs');

var PORT = process.env.PORT || 2000;
var X_FCSTORE_SECRET = process.env.X_FCSTORE_SECRET;
var UPLOADS_DIR = __dirname + '/uploads';

var app = express();
var storage = multer.diskStorage({
    destination: function(req, file, done) {
        const bucket = req.path.split('/')[0];
        if (!bucket) {
            done(new Error('bucket not specified'));
        }
        done(null, UPLOADS_DIR + bucket);
    },
    filename: function(req, file, done) {
        done(null, file.originalname);
    }
});
var upload = multer({ storage: storage }).single('myfile');

app.use(function checkAuth(req, res, next) {
    if (req.headers['x-fcstore-secret'] !== X_FCSTORE_SECRET) {
        return res
            .status(401)
            .json({ status: 'error', reason: 'unauthorized' });
    }
    next();
});

app.get('/', function(req, res) {
    fs.readdir(UPLOADS_DIR, function(err, dirContent) {
        if (err) {
            console.error('error reading buckets list', err);
            return res
                .status(500)
                .json({ status: 'error', reason: err.message });
        }
        res.json(dirContent);
    });
});

app.get('/:bucket', function(req, res) {
    fs.readdir(UPLOADS_DIR + '/' + req.params.bucket, function(
        err,
        dirContent
    ) {
        if (err) {
            console.error('error reading bucket ' + req.params.bucket, err);
            return res
                .status(500)
                .json({ status: 'error', reason: err.message });
        }
        res.json(dirContent);
    });
});

app.get('/:bucket/:file', function(req, res) {
    fs.createReadStream(
        pathlib.resolve(UPLOADS_DIR, req.params.bucket, req.params.file)
    ).pipe(res);
});

app.post('/:bucket', function(req, res) {
    upload(req, res, function(err) {
        if (err) {
            console.error('upload failed', err);
            return res
                .status(500)
                .json({ status: 'error', reason: err.message });
        }
        res.json({ status: 'success' });
    });
});

app.listen(PORT, function() {
    console.log('Server is running on port ' + PORT);
});

fs.exists(UPLOADS_DIR, function(exists) {
    if (!exists) {
        fs.mkdir(UPLOADS_DIR, function(err) {
            if (err) {
                console.error(
                    'creating uploads dir failed ' + UPLOADS_DIR,
                    err
                );
            } else {
                console.log('uploads dir created');
            }
        });
    }
});
