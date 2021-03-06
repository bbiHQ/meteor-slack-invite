Slack = new Mongo.Collection('slack');



if (Meteor.isServer) {
  Meteor.setInterval(function() {
    try {
      HTTP.get('https://slack.com/api/rtm.start', {params: {
        token: Meteor.settings.slackToken
      }}, function(err, res) {
        if (!err && res.data && res.data.users) {
          var users = res.data.users;
          var total = users.length;
          var active = _.filter(users, function(user) {
            return 'active' == user.presence;
          }).length;

          var data = {
            _id: 'slack',
            online: active,
            registered: total
          };
          // Extend data with team info.
          _.extend(data, _.pick(res.data.team, 'name', 'domain'));

          // Upsert data in Mongo.
          Slack.upsert({_id: 'slack'}, data);
        }
      });
    } catch(e) {
      console.log(e);
    }
  }, 30000);

  Meteor.publish('slack', function() {
    return Slack.find({_id:'slack'});
  });

  Meteor.methods({
    invite: function(email) {
      console.log('method invite: called');

      console.log('Slack.find().count():',Slack.find().count());
      
      if (!this.isSimulation && Slack.find().count() === 1) {

        console.log('method invite: !isSimulation');

        var domain = Slack.findOne().domain;

        if (domain) {
          console.log('method invite: domain is',domain);

          var url = "https://" + domain + ".slack.com/api/users.admin.invite";
          var data = {
            email: email,
            token: Meteor.settings.slackToken,
            set_active: true
          };

          try {
            console.log('sending request to slack', data,'...');
            var data = HTTP.call("POST", url, {
              params: data
            }).data;
          } catch(e) {
            console.log('post exception:',e);
          }

          return data;
        }
      }
    }
  });
}
else {
  Template.slackInvite.onCreated(function() {
    var instance = this;
    instance.invite = new ReactiveVar(false);
    instance.error = new ReactiveVar("");
    instance.subscribe('slack');
  });

  Template.slackInvite.helpers({
    invite: function() {
      var instance = Template.instance();
      return instance.invite.get();
    },

    slack: function() {
      return Slack.findOne();
    },

    error: function() {
      var instance = Template.instance();
      return instance.error.get();
    }
  });

  Template.slackInvite.events({
    'submit form': function(e, instance) {
      e.preventDefault();
      var email = instance.find('input').value;
      Meteor.call('invite', email, function(err, res) {
        console.log('res:',res);
        if (!err && res.ok) {
          instance.error.set("");
          instance.invite.set(true);
        }
        else if (!err){
          instance.error.set(res.error);
        }
        else {
          instance.error.set('Someting is broken here.');
        }
      });
    }
  });
}
