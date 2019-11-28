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

function readBucket(dir, done) {
    fs.readdir(dir, function (err, dirContent) {
        if (err) {
            return done(err);
        }

        var result = [];
        
        function readStat() {
            var file = dirContent.pop();
            if (!file) {
                return done(null, result);
            }
            fs.stat(pathlib.join(dir, file), function (err, stats) {
                if (err) {
                    console.error('reading file stat failed file: ' + dir + '/' + file, err);
                    return done(err);
                }
                result.push({
                    name: file,
                    lastModified: Math.round(stats.mtimeMs)
                });
                readStat();
            });
        }
        
        readStat();
    });
}

app.get('/:bucket', function(req, res) {
    readBucket(pathlib.join(UPLOADS_DIR, req.params.bucket), function (err, bucketContent) {
        if (err) {
            console.error('error reading bucket ' + req.params.bucket, err);
            return res
                .status(500)
                .json({ status: 'error', reason: err.message });
        }
        res.json(bucketContent);        
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
