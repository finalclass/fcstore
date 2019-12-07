var express = require('express');
var multer = require('multer');
var pathlib = require('path');
var fs = require('fs');

var PORT = process.env.PORT || 2000;
var X_FCSTORE_SECRET = process.env.X_FCSTORE_SECRET;
var UPLOADS_DIR = __dirname + '/uploads';

function ensureBucketDirExists(bucket, done) {
    var destDir = pathlib.resolve(UPLOADS_DIR, bucket);
    fs.exists(destDir, function (exists) {
        if (exists) {
            return done(null, destDir);
        }
        fs.mkdir(destDir, function (err) {
            if (err) {
                console.error('creating bucket dir failed ' + destDir, err);
                return done(err);
            }
            done(null, destDir);
        });
    });
}

var app = express();
var storage = multer.diskStorage({
    destination: function(req, file, done) {
        var bucket = req.path.split('/')[1];
        if (!bucket) {
            done(new Error('bucket not specified'));
        }
        ensureBucketDirExists(bucket, done);
    },
    filename: function(req, file, done) {
        done(null, file.originalname);
    }
});
var upload = multer({ storage: storage }).single('filedata');

app.use(function checkAuth(req, res, next) {
    console.log(req.method + ' ' + req.path + ' started');
    if (X_FCSTORE_SECRET && req.headers['x-fcstore-secret'] !== X_FCSTORE_SECRET) {
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
        console.log(req.method + ' ' + req.path + ' success');
        res.json(dirContent);
    });
});

function readBucket(dir, done) {
    fs.exists(dir, function (exists) {
        if (!exists) {
            return done(null, []);
        }
        fs.readdir(dir, function (err, dirContent) {
            if (err) {
                return done(err);
            }

            var result = [];

            function readStat() {
                var file = dirContent.pop();
                if (!file) {
                    return done(null, result.sort(function (a, b) {
                        return b.lastModified - a.lastModified;
                    }));
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
    });
}

app.get('/:bucket', function(req, res) {
    var limit = req.query.limit;

    readBucket(pathlib.join(UPLOADS_DIR, req.params.bucket), function (err, bucketContent) {
        if (err) {
            console.error('error reading bucket ' + req.params.bucket, err);
            return res
                .status(500)
                .json({ status: 'error', reason: err.message });
        }
        if (limit) {
            console.log(req.method + ' ' + req.path + ' success', req.query);
            res.json(bucketContent.slice(0, limit));
        } else {
            console.log(req.method + ' ' + req.path + ' success');
            res.json(bucketContent);
        }
    });
});

app.get('/:bucket/:file', function(req, res) {
    var filePath = pathlib.resolve(UPLOADS_DIR, req.params.bucket, req.params.file);
    fs.readFile(filePath, function (err, buff) {
        if (err) {
            console.error('getting bucket file failed', err);
            return res.status(500).json({ status: 'error', reason: err.message });
        }

        fs.stat(filePath, function (err, stat) {
            if (err) {
                console.log('getting bucket file stat failed', err);
                return res.status(500).json({ status: 'error', reason: err.message });
            }
            console.log(req.method + ' ' + req.path + ' success');
            res.json({
                name: req.params.file,
                lastModified: Math.round(stat.mtimeMs),
                content: buff.toString('base64')
            });
        });
    });
});

app.post('/:bucket', function(req, res) {
    upload(req, res, function(err) {
        if (err) {
            console.error('upload failed', err);
            return res
                .status(500)
                .json({ status: 'error', reason: err.message });
        }
        console.log(req.method + ' ' + req.path + ' success');
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
