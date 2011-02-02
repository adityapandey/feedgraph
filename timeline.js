$(document).ready(function() {
  var app = new Application();
  app.start();
});

var HOURS_PER_DAY = 24;

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
  this.timelineData = [];
  this.hourlyData = [];
  for(var i = 0; i < HOURS_PER_DAY; ++i) {
    this.hourlyData[i] = 0;
  }

  var self = this;

  this.levenstein = function(a, b) {
var i;
	var j;
	var cost;
	var d = new Array();
 
	if ( a.length == 0 )
	{
		return b.length;
	}
 
	if ( b.length == 0 )
	{
		return a.length;
	}
 
	for ( i = 0; i <= a.length; i++ )
	{
		d[ i ] = new Array();
		d[ i ][ 0 ] = i;
	}
 
	for ( j = 0; j <= b.length; j++ )
	{
		d[ 0 ][ j ] = j;
	}
 
	for ( i = 1; i <= a.length; i++ )
	{
		for ( j = 1; j <= b.length; j++ )
		{
			if ( a.charAt( i - 1 ) == b.charAt( j - 1 ) )
			{
				cost = 0;
			}
			else
			{
				cost = 1;
			}
 
			d[ i ][ j ] = Math.min( d[ i - 1 ][ j ] + 1, d[ i ][ j - 1 ] + 1, d[ i - 1 ][ j - 1 ] + cost );
			
			if(
         i > 1 && 
         j > 1 &&  
         a.charAt(i - 1) == b.charAt(j-2) && 
         a.charAt(i-2) == b.charAt(j-1)
         ){
          d[i][j] = Math.min(
            d[i][j],
            d[i - 2][j - 2] + cost
          )
         
			}
		}
	}
 
	return d[ a.length ][ b.length ];
}

  this.collectFeed = function(limit, until) {
    if (!self.timezoneDiffMsecs) {
      self.getTimezone();
    }
    $('#TL-status').text(
        'Getting posts from feed... Got ' + self.postCount + ' so far.');
    if (!limit || !until) {
      FB.api('/me/feed', self.processFeed);
    } else {
      FB.api('/me/feed', {'limit':limit, 'until':until}, self.processFeed);
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
  
  this.getTimelineChartData = function() {
    var rows = [];
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

  this.getBarChartData = function() {
    var hourFromNumber = function(num) {
      if (num == 0 || num == 24) {
        return '12am';
      }
      if (num < 12) {
        return num + 'am';
      }
      if (num == 12) {
        return '12pm';
      }
      return (num - 12) + 'pm';
    }
    var chartData = new google.visualization.DataTable();
    chartData.addColumn('string', 'Hour');
    chartData.addColumn('number', 'Posts');
    chartData.addRows(HOURS_PER_DAY);
    for (var i = 0; i < HOURS_PER_DAY; ++i) {
      chartData.setValue(i, 0,
          hourFromNumber(i) + '-' + hourFromNumber(i+1));
      chartData.setValue(i, 1, self.hourlyData[i]);
    }
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
        var ONE_DAY_MSECS = HOURS_PER_DAY * 60 * 60 * 1000;
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

        self.hourlyData[date.getHours()]++;
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
    return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
  }

  this.getValueFromUri = function(uri, key_name) {
    var key_regex = new RegExp('&' + key_name + '=[^&]*');
    return unescape(uri.match(key_regex)[0].substr(key_name.length + 2));
  }
}

var Application = function() {
  this.feedgraph = null;
  this.timelineChart = null;
  this.barChart = null;

  var self = this;

  this.start = function() {
    $('#TL-debug').hide();
    self.feedgraph = new Feedgraph();
    $('#TL-refresh').click(self.onTLRefresh);
    $('#TL-refresh').attr('disabled', 'disabled');
    self.loadFacebookSdk();
    FB.getLoginStatus(self.handleLoginStatus);
    self.loadVisualization();
  }

  this.onTLRefresh = function() {
    self.timelineChart.draw(self.feedgraph.getTimelineChartData());
    self.barChart.draw(self.feedgraph.getBarChartData(),
        {'width':700, 'height':300, 'hAxis':{'title':'Hour'}});
  }

  this.loadFacebookSdk = function() {
    FB.init({
      'appId':'279362135009',
      'status':true,
      'cookie':true,
      'xfbml':true});
  }

  this.handleLoginStatus = function(response) {
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
        {'perms':'read_stream'}
      );
    });
  }
  
  this.userLoggedIn = function() {
    $('#TL-login').hide('slow');
    $('#TL-timeline-container').show('slow');
    self.feedgraph.collectFeed();
  }

  this.loadVisualization = function() {
    google.load('visualization',
                '1',
                {'packages':['annotatedtimeline', 'columnchart']});
    google.setOnLoadCallback(function() {
      var chartData = new google.visualization.DataTable();
      chartData.addColumn('date', 'Date');
      chartData.addColumn('number', 'Posts');
      self.timelineChart = new google.visualization.AnnotatedTimeLine(
          document.getElementById('TL-timeline'));
      self.barChart = new google.visualization.ColumnChart(
          document.getElementById('TL-hourchart'));
      $('#TL-refresh').removeAttr('disabled').focus();
    });
  }
}
