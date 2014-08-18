var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/room/:roomId', function(req, res) {
  res.render('room');
});

module.exports = router;
