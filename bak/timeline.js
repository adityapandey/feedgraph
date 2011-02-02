(function () {
	$(document).ready (function() {
		$('#TL-debug').hide();
		$('#TL-refresh').attr('disabled', 'disabled');
		$('#TL-refresh').click(onTLRefresh);
		loadGlobals();
		loadFacebookSdk();
		FB.getLoginStatus(function(response) {
			if (response.session) {
				// User is logged in.
				showTimeline();
			} else {
				showLoginButton();
			}
		});
		loadVisualization();
	});
}) ()

function loadGlobals() {
	window.postCount = 0;
	window.timeZoneMilliseconds = 0;
	window.timelineData = new Object();
}

function loadVisualization() {
	google.load('visualization', '1', {'packages':['annotatedtimeline']});
	google.setOnLoadCallback(function() {
		var chartData = new google.visualization.DataTable();
		chartData.addColumn('date', 'Date');
		chartData.addColumn('number', 'Posts');
		window.chart = new google.visualization.AnnotatedTimeLine(document.getElementById('TL-timeline'));
	});
}

function loadFacebookSdk() {
	FB.init({
		appId : '279362135009',
		status : true,
		cookie : true,
		xfbml : true});
}

function showTimeline() {
	$('#TL-login').hide('slow');
	$('#TL-timeline-container').show('slow');
	getTimezone();
	getFeeds();
}

function getTimezone() {
	$('#TL-status').text('Getting timezone...');
	FB.api('/me', function(response) {
		if (!response || response.error) {
			$('#TL-status').html('Error occurred!' + debugOutput(feed.error));
		} else {
			$('#TL-status').text('Timezone set to ' + response.timezone);
			window.timeZoneMilliseconds = response.timezone * 60 * 60 * 1000;
		}
	});
}

function getFeeds(limit, until) {
	$('#TL-status').text('Getting posts from feed... Got ' + window.postCount + ' so far.');
	if (!limit || !until) {
		FB.api('/me/feed', populateTimeline);
	} else {
		FB.api('/me/feed', {limit: limit, until: until}, populateTimeline);
	}
}

function onTLRefresh() {
	var rows = new Array();
	for (date in window.timelineData) {
		d = date.split('-');
		rows.push([new Date(d[0], d[1], d[2], 0, 0, 0, 0), window.timelineData[date]]);
	}
	var chartData = new google.visualization.DataTable();
	chartData.addColumn('date', 'Date');
	chartData.addColumn('number', 'Posts');
	chartData.addRows(rows);
	window.chart.draw(chartData);
}

function populateTimeline(feed) {
	if (!feed || feed.error) {
		$('#TL-status').html('Error occurred!' + debugOutput(feed.error));
	} else {
		window.postCount += feed.data.length;
		for (i in feed.data) {
			var date = dateFromString(feed.data[i].created_time);
			var key = date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
			if (!window.timelineData[key]) {
				window.timelineData[key] = 1;
			} else {
				window.timelineData[key]++;
			}
		}
		$('#TL-refresh').removeAttr('disabled').focus();
		
		if (feed.paging) {
			var limit = getValueFromUri(feed.paging.next, 'limit');
			var until = getValueFromUri(feed.paging.next, 'until');
			getFeeds(limit, until);
		} else {
			$('#TL-status').text('Done collecting feed. ' + window.postCount + ' posts in all.');
		}
	}
}

function dateFromString(fb_date_string) {
	var d = fb_date_string.match(/[0-9]+/g);
	// d[1] - 1 since months are zero-based!
	var dt = new Date(d[0], d[1] - 1, d[2], d[3], d[4], d[5], 0);
	return new Date(dt.valueOf() + window.timeZoneMilliseconds);
}

function getValueFromUri(uri, key_name) {
	var key_regex = new RegExp('&' + key_name + '=[^&]*');
	return unescape(uri.match(key_regex)[0].substr(key_name.length + 2));
}

function debugOutput(obj) {
	var retval = '';
	for (key in obj) {
		retval += '<tr><th>' + key + '</th><td>' + obj[key] + '</td></tr>';
	}
	return retval;
}

function showLoginButton() {
	$('#TL-login').show('slow');
	$('#TL-login-button').click(function() {
		FB.login(
			function(response) {
				if (response.session) {
					showTimeline();
				}
			},
			{perms: 'read_stream'}
		);
	});
}