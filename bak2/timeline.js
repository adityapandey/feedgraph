$(document).ready(function() {
  var app = new Application();
  app.start();
});

var debugOutput = function(obj) {
  var retval = '';
  for (key in obj) {
    retval += '<tr><th>' + key + '</th><td>' + obj[key] + '</td></tr>';
  }
  return retval;
}
  
var Feedgraph = function() {
  this.postCount = 0;
  this.timezoneDiffMsecs = null;
  this.timelineData = {};

  var self = this;

  this.collectFeed = function(limit, until) {
    if (!self.timezoneDiffMsecs) {
      self.getTimezone();
    }
    $('#TL-status').text(
        'Getting posts from feed... Got ' + self.postCount + ' so far.');
    if (!limit || !until) {
      FB.api('/me/feed', self.processFeed);
    } else {
      FB.api('/me/feed', {limit: limit, until: until}, self.processFeed);
    }
  }

  this.getTimezone = function() {
    $('#TL-status').text('Getting timezone...');
    FB.api('/me', function(response) {
      if (!response || response.error) {
        $('#TL-status').html('Error occurred!' + debugOutput(response.error));
      } else {
        $('#TL-status').text('Timezone set to ' + response.timezone);
        self.timezoneDiffMsecs = response.timezone * 60 * 60 * 1000;
      }
    });
  }
  
  this.getChartData = function() {
    var rows = new Array();
    for (date in self.timelineData) {
      var d = date.split('-');
      rows.push([new Date(d[0], d[1], d[2], 0, 0, 0, 0),
                self.timelineData[date]]);
    }
    var chartData = new google.visualization.DataTable();
    chartData.addColumn('date', 'Date');
    chartData.addColumn('number', 'Posts');
    chartData.addRows(rows);
    return chartData;
  }

  this.processFeed = function(feed) {
    if (!feed || feed.error) {
      $('#TL-status').html('Error occurred!' + debugOutput(feed.error));
    } else {
      self.postCount += feed.data.length;
      for (i in feed.data) {
        var date = self.dateFromFbDateString(feed.data[i].created_time);
        var today = self.keyFromDate(date);
        var ONE_DAY_MSECS = 24 * 60 * 60 * 1000;
        var tomorrow = self.keyFromDate(
            new Date(date.valueOf() + ONE_DAY_MSECS));
        var yesterday = self.keyFromDate(
            new Date(date.valueOf() - ONE_DAY_MSECS));
        if (!self.timelineData[today]) {
          self.timelineData[today] = 1;
          if (!self.timelineData[yesterday]) {
            self.timelineData[yesterday] = 0;
          }
          if (!self.timelineData[tomorrow]) {
            self.timelineData[tomorrow] = 0;
          }
        } else {
          self.timelineData[today]++;
        }
      }
      
      if (feed.paging) {
        var limit = self.getValueFromUri(feed.paging.next, 'limit');
        var until = self.getValueFromUri(feed.paging.next, 'until');
        self.collectFeed(limit, until);
      } else {
        $('#TL-status').text(
            'Done collecting feed. ' + self.postCount + ' posts in all.');
      }
    }
  }

  this.dateFromFbDateString = function(fb_date_string) {
    var d = fb_date_string.match(/[0-9]+/g);
    // d[1] - 1 since months are zero-based!
    var dt = new Date(d[0], d[1] - 1, d[2], d[3], d[4], d[5], 0);
    return new Date(dt.valueOf() + self.timezoneDiffMsecs);
  }

  this.keyFromDate = function(date) {
    $('#TL-debug').html(debugOutput(date));
    return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
  }

  this.getValueFromUri = function(uri, key_name) {
    var key_regex = new RegExp('&' + key_name + '=[^&]*');
    return unescape(uri.match(key_regex)[0].substr(key_name.length + 2));
  }
}

var Application = function() {
  this.feedgraph = null;
  this.chart = null;

  var self = this;

  this.start = function() {
    //$('#TL-debug').hide();
    self.feedgraph = new Feedgraph();
    $('#TL-refresh').click(self.onTLRefresh);
    $('#TL-refresh').attr('disabled', 'disabled');
    $('#TL-debug').html(debugOutput(this));
    self.loadFacebookSdk();
    FB.getLoginStatus(self.handleLoginStatus);
    self.loadVisualization();
  }

  this.onTLRefresh = function() {
    self.chart.draw(self.feedgraph.getChartData());
  }

  this.loadFacebookSdk = function() {
    FB.init({
      appId : '279362135009',
      status : true,
      cookie : true,
      xfbml : true});
  }

  this.handleLoginStatus = function(response) {
    $('#TL-debug').html(debugOutput(this));
    if (!response.session) {
      self.showLoginButton();
    } else {
      self.userLoggedIn();
    }
  }

  this.showLoginButton = function() {
    $('#TL-login').show('slow');
    $('#TL-login-button').click(function() {
      FB.login(
        function(response) {
          if (response.session) {
            self.userLoggedIn();
          }
        },
        {perms: 'read_stream'}
      );
    });
  }
  
  this.userLoggedIn = function() {
    $('#TL-login').hide('slow');
    $('#TL-timeline-container').show('slow');
    self.feedgraph.collectFeed();
  }

  this.loadVisualization = function() {
    google.load('visualization', '1', {'packages':['annotatedtimeline']});
    google.setOnLoadCallback(function() {
      var chartData = new google.visualization.DataTable();
      chartData.addColumn('date', 'Date');
      chartData.addColumn('number', 'Posts');
      self.chart = new google.visualization.AnnotatedTimeLine(
          document.getElementById('TL-timeline'));
      $('#TL-refresh').removeAttr('disabled').focus();
    });
  }
}
