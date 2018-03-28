var fs = require('fs');
var JiraClient = require('jira-connector');

var jira = new JiraClient( {
    host: 'issues.liferay.com',
    basic_auth: {
        username: process.env.USERNAME,
        password: process.env.PASSWORD
    }
});

function fetchIssues() {
  jira.search.search({
    jql: 'project = lpp AND status NOT IN (resolved, "TS Complete", ' +
      '"Solution Proposed", "Ready for QA", closed, "Audit", ' +
      '"Automated Testing", "On Hold") AND type IN (Patch, Task, ' +
      '"L1 Escalation") AND assignee IN (membersOf(liferay-support-ts), ' +
      'membersOf(liferay-support-ts-us), support-hu)',
    maxResults: 500,
    fields: [
      'key', 'fixVersions', 'customfield_20021', 'customfield_12120', 'priority',
      'customfield_10731', 'assignee', 'status', 'components', 'issuetype',
      'customfield_19120', 'customfield_20321', 'customfield_20322', 'summary',
      'duedate', 'comment', 'customfield_10194'
    ],
    expand: [
      'changelog'
    ]
  }, function(error, response) {
    if (error) {
      console.log("Error = " + JSON.stringify(error));
    }
    else {
      var issues = [];

      response.issues.forEach(function(issue) {
        var trimmedIssue = {};

        trimmedIssue.key = issue.key;
        trimmedIssue.summary = issue.fields.summary;
        trimmedIssue.issueType = issue.fields.issuetype.name.toLowerCase().replace(/ /g,"-");
        trimmedIssue.priority = issue.fields.priority.name.toLowerCase();
        trimmedIssue.businessValue = issue.fields.customfield_10194;
        trimmedIssue.lesaLink = issue.fields.customfield_10731;
        trimmedIssue.status = issue.fields.status.name;
        trimmedIssue.dueDate = issue.fields.duedate;
        trimmedIssue.assignee = issue.fields.assignee.key;

        trimmedIssue.component = [];

        issue.fields.components.forEach(function(component) {
          trimmedIssue.component.push(component.name);
        });

        trimmedIssue.fixVersions = [];

        issue.fields.fixVersions.forEach(function(fixVersion) {
          trimmedIssue.fixVersions.push(fixVersion.name);
        });

        if (issue.fields.customfield_12120) {
          trimmedIssue.issueFixedIn = issue.fields.customfield_12120.value;
        }

        if (issue.fields.customfield_19120) {
          trimmedIssue.difficulty = issue.fields.customfield_19120.value;
        }

        if (issue.fields.customfield_20321) {
          trimmedIssue.toDo = issue.fields.customfield_20321.value;
        }

        if (issue.fields.customfield_20322) {
          trimmedIssue.openDepenencies = [];

          issue.fields.customfield_20322.forEach(function (openDependencies) {
            trimmedIssue.openDepenencies.push(openDependencies.value);
          });
        }

        if (issue.fields.customfield_20021) {
          trimmedIssue.additionalInformation = [];

          issue.fields.customfield_20021.forEach(function (additionalInformation) {
            trimmedIssue.additionalInformation.push(additionalInformation.value);
          });
        }

        if (trimmedIssue.dueDate && (new Date() > Date.parse(trimmedIssue.dueDate))) {
          trimmedIssue.isPastDueDate = true;
        }
        else {
          trimmedIssue.isPastDueDate = false;
        }


        trimmedIssue.hoursSinceAssigneeComment = getHoursSinceLastComment(
          issue.fields.comment.comments, trimmedIssue.assignee);


        trimmedIssue.hoursSinceAssigned = getHoursSinceAssignedDate(
          issue.changelog.histories, trimmedIssue.assignee);


        trimmedIssue.hoursSinceStatusChange = getHoursSinceStatusChange(
          issue.changelog.histories, trimmedIssue.status);

        issues.push(trimmedIssue);
      });

      fs.writeFile("test.json", JSON.stringify(issues));

      console.log("Finished writing JSON");
    }
  });
}

function getHoursSinceAssignedDate(histories, assignee) {
  for (var i = histories.length - 1; i >= 0; i--) {
    var items = histories[i].items;

    for (var j = 0; j < items.length; j++) {
      if ((items[j].field === "assignee") &&
          (items[j].to === assignee)) {

        var assigneeDate = new Date(Date.parse(histories[i].created));

        var timeElapsed = new Date().getTime() - assigneeDate;

        return Math.round(timeElapsed / 3600000);
      }
    }
  }
}

function getHoursSinceLastComment(comments, assignee) {
  for (var i = comments.length - 1; i >= 0; i--) {
    if (comments[i].author.key === assignee) {
      var commentDate = new Date(Date.parse(comments[i].created));

      var timeElapsed = new Date().getTime() - commentDate;

      return Math.round(timeElapsed / 3600000);
    }
  }
}

function getHoursSinceStatusChange(histories, status) {
  for (var i = histories.length - 1; i >= 0; i--) {
    var items = histories[i].items;

    for (var j = 0; j < items.length; j++) {
      if ((items[j].field === "status") &&
          (items[j].toString === status)) {

        var statusChangeDate = new Date(Date.parse(histories[i].created));

        var timeElapsed = new Date().getTime() - statusChangeDate;

        return Math.round(timeElapsed / 3600000);
      }
    }
  }
}

module.exports = {
  fetchIssues: fetchIssues
};