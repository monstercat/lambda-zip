var aws            = require('aws-sdk');
var async          = require('async');
var archiver       = require('archiver');
var path           = require('path');

var s3 = new aws.S3();

exports.handler = function(event, context) {
  var filename = event.filename
    , tracks = event.tracks
    , userId = event.userId
    , bucket = event.bucket
    , keyPrefix = event.keyPrefix

  var zip = archiver.create('zip', {store: true});
  zip.on('error', function(err) {
    console.log('zip error', err);
    context.fail(err);
  });

  // Stream upload.
  var obj = {
    Bucket: bucket,
    Key: path.join(keyPrefix, userId + '-' + filename),
    Body: zip
  };

  s3.upload(obj).
  on('error', function(err) {
    console.log('upload error', err);
    context.fail(err);
  }).
  send(function(err, data){
    if (err) return context.fail(err);

    console.log('finished upload, returning url to user.');
    var params = {
      Key: obj.Key,
      Bucket: obj.Bucket,
      ResponseContentDisposition: attachment(filename)
    }
    context.done(null, {
      url: s3.getSignedUrl('getObject', params)
    });
  });

  async.eachSeries(tracks, processTrack.bind(null, zip), function(err) {
    if (err) {
      console.log('processTrack error', err);
      return context.fail(message);
    }

    zip.finalize();
  });
}

function processTrack(zip, track, cb) {
  var obj = {
    Bucket: bucket,
    Key: track.key
  };

  // Stream the download
  var stream = s3.getObject(obj).createReadStream();
  zip.append(stream, {name: track.filename});
  stream.on('finish', function() {
    cb(null);
  });

  // Download entirely to memory
  // s3.getObject(obj, function(err, data) {
  //   if (err) return cb(err);
  //   console.log('writing data', track.filename);
  //   zip.append(data.Body, {name: track.filename});
  //   cb(null);
  // });
}

function attachment(filename) {
  return "attachment; filename=\"" + filename + '"';
}
