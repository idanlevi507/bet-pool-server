'use strict';
const schedule = require('node-schedule');
const logger = require('../utils/logger');
const _ = require('lodash');
const moment = require('moment');
const apiFootballSdk = require('../lib/apiFootballSDK');
const EventRepository = require('../repositories/eventRepository');
const TeamRepository = require('../repositories/teamRepository');
const GameRepository = require('../repositories/gameRepository');
const eventRepository = new EventRepository();
const teamRepository = new TeamRepository();
const gameRepository = new GameRepository();


function extractId(refUrl){
    return refUrl.match(/([^\/]*)\/*$/)[1];
}
function extractTeam(team) {
    if (_.isEmpty(_.get(team, 'name'))) return Promise.resolve(null);
    const teamId = extractId(_.get(team, '_links.self.href'));
    return extractPlayers(teamId)
    .then((players) => {
        return teamRepository.findBy3ptData({
            '3ptName': 'apiFootball',
            id: _.get(team, '_links.self.href')
        }).then((teamModel) => {
            if (_.isNil(teamModel)) {
                return teamRepository.createTeam({
                    name: team.name,
                    code: team.code,
                    flag: team.crestUrl,
                    players,
                    '3pt': _.assign({
                        '3ptName': 'apiFootball',
                        id: _.get(team, '_links.self.href')
                    }, _.pick(team, ['name', 'code']))
                });
            }else {
                return teamModel;
            }
        });
    });

}

function extractPlayers(teamId){
    return apiFootballSdk().getPlayers(teamId)
    .then((players) => {
        return _.map(players, 'name');
    });
};

function extractGame(event, game) {
    if (_.isEmpty(_.get(game, 'homeTeamName')) || _.isEmpty(_.get(game, 'awayTeamName'))) return Promise.resolve(null);
    return gameRepository.findBy3ptData({
        '3ptName': 'apiFootball',
        'id': _.get(game, '_links.self.href')
    }).then((gameModel) => {
        if (_.isNil(gameModel)) {
            return Promise.all([
                teamRepository.findBy3ptData({'3ptName': 'apiFootball', id: _.get(game, '_links.homeTeam.href')}),
                teamRepository.findBy3ptData({'3ptName': 'apiFootball', id: _.get(game, '_links.awayTeam.href')})
            ]).then(([team1Model, team2Model]) => {
                return gameRepository.createGame({
                    event: event._id,
                    playAt: game.date,
                    team1: team1Model._id,
                    team2: team2Model._id,
                    status: game.status,
                    round: game.matchday,
                    '3pt': _.assign({
                        '3ptName': 'apiFootball',
                        status: game.status,
                        id: _.get(game, '_links.self.href')
                    })
                });
            });
        }else {
            const score1 = _.get(game, 'result.goalsHomeTeam') || 0;
            const score2 = _.get(game, 'result.goalsAwayTeam') || 0;
            const  status = game.status;
            return gameRepository.updateGame({id: gameModel.id, score1, score2, status});
        }
    });
}

module.exports = {

    start() {
        schedule.scheduleJob('*/1 * * * *', () => {
            return apiFootballSdk().getCompetitions(moment().year())
                .then((competitions) => {
                    competitions = _.filter(competitions, {id: 467}); // WORLD CUP only
                    return Promise.all(_.forEach(competitions, (competition) => {
                        return eventRepository.findBy3ptData({'3ptName': 'apiFootball', id: competition.id})
                            .then((event) => {
                                if (_.isNil(event)) {
                                    return eventRepository.createEvent({
                                        name: competition.caption,
                                        lastUpdated: competition.lastUpdated,
                                        '3pt': _.assign({'3ptName': 'apiFootball'}, _.pick(competition, ['id', 'caption', 'league', 'year', 'lastUpdated']))
                                    });
                                }
                                if (_.isNil(event.lastUpdated) || (event.lastUpdated < competition.lastUpdated)){
                                    event.lastUpdated = competition.lastUpdated;
                                    return event.save().then(() => event);
                                }else {
                                    return null;
                                }
                            })
                            .then((event) => {
                                if (!event) return Promise.resolve(null);
                                return apiFootballSdk().getTeams(competition.id)
                                    .then((teams) => {
                                        return Promise.all(_.map(teams, extractTeam));
                                    })
                                    .then((teams) => {
                                        if (_.isEmpty(event.teams)){
                                            event.teams = _.map(teams, '_id');
                                            return event.save();
                                        } else {
                                            return Promise.resolve(event);
                                        }
                                    });
                            })
                            .then((event) => {
                                if (!event) return Promise.resolve(null);
                                return apiFootballSdk().getFixtures(competition.id)
                                    .then((games) => {
                                        return Promise.all(_.map(games, _.curry(extractGame)(event))).then((data) => Promise.resolve(event));
                                    });
                            });
                    }));
                }).catch((err) => {
                    logger.log('error', 'An error has occurred while processing a apiFootball job ' + err.stack);
                });
        });
    }
};

