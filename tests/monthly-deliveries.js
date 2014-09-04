var controller = require('../controllers/monthly-deliveries'),
    db = require('../db'),
    moment = require('moment'),
    sinon = require('sinon');

var clock;

exports.setUp = function(callback) {
  clock = sinon.useFakeTimers();
  callback();
};

exports.tearDown = function(callback) {
  clock.restore();
  if (db.fti.restore) {
    db.fti.restore();
  }
  callback();
};

exports['get returns errors'] = function(test) {
  test.expect(2);
  var fti = sinon.stub(db, 'fti').callsArgWith(2, 'bang');
  controller.get({}, function(err, results) {
    test.equals(err, 'bang');
    test.equals(fti.callCount, 1);
    test.done();
  });
};

exports['get returns errors from second fti'] = function(test) {
  test.expect(2);
  var fti = sinon.stub(db, 'fti');
  fti.onFirstCall().callsArgWith(2, null, {
    rows: [
      {
        doc: {
          patient_id: 1,
          form: 'R',
          reported_dated: moment().subtract(60, 'weeks')
        }
      }
    ]
  });
  fti.onSecondCall().callsArgWith(2, 'boom');
  controller.get({}, function(err, results) {
    test.equals(err, 'boom');
    test.equals(fti.callCount, 2);
    test.done();
  });
};

exports['get returns monthly deliveries count'] = function(test) {
  test.expect(2);
  var fti = sinon.stub(db, 'fti');
  fti.onFirstCall().callsArgWith(2, null, {
    rows: [
      {
        doc: {
          patient_id: 1,
          form: 'R',
          reported_date: moment().subtract(60, 'weeks')
        }
      },
      {
        doc: {
          patient_id: 2,
          form: 'R',
          reported_date: moment().subtract(80, 'weeks')
        }
      },
      {
        doc: {
          patient_id: 3,
          form: 'P',
          lmp_date: moment().subtract(70, 'weeks')
        }
      }
    ]
  });
  fti.onSecondCall().callsArgWith(2, null, {
    rows: [
      {
        doc: {
          patient_id: 1,
          reported_date: moment().subtract(30, 'weeks')
        }
      },
      {
        doc: {
          patient_id: 4,
          reported_date: moment().subtract(16, 'weeks')
        }
      }
    ]
  });
  controller.get({}, function(err, results) {
    var expected = [
      { month: 'Jan 1969', count: 0 },
      { month: 'Feb 1969', count: 0 },
      { month: 'Mar 1969', count: 1 }, // delivery report for patient 1
      { month: 'Apr 1969', count: 0 },
      { month: 'May 1969', count: 0 },
      { month: 'Jun 1969', count: 2 }, // estimated date for patient 2 & 3
      { month: 'Jul 1969', count: 0 },
      { month: 'Aug 1969', count: 0 },
      { month: 'Sep 1969', count: 1 }, // delivery report for patient 4
      { month: 'Oct 1969', count: 0 },
      { month: 'Nov 1969', count: 0 },
      { month: 'Dec 1969', count: 0 } 
    ];
    test.same(results, expected);
    test.equals(fti.callCount, 2);
    test.done();
  });
};