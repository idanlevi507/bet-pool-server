
const Pool = require('../models/Pool');
const Game = require('../models/Game');
var logger = require('../utils/logger');
var Q = require('q');
var mongoose = require('mongoose');

function PoolRepository() {
    this.findById = findById;
    this.createPool = createPool;
    this.addGames = addGames;
    this.addEvents = addEvents;
    this.addParticipates = addParticipates;
    this.findGameById = findGameById;
    this.findParticipateByUserId = findParticipateByUserId;
    this.findByUserId = findByUserId;
}

function findById(id) {
    var query = {
        _id: id
    };
    return Pool.findOne(query)
    .populate({path: 'events', model: 'Event'}).exec()
    .then((pool) => {
        return Game.populate(pool.events, {path: 'games'}).then(() => pool);
    });

}

function findByUserId(userId) {
    var deferred = Q.defer();
    Pool.find({'participates.user': userId}, function (err, pools) {
        if (err) {
            deferred.reject(err);
        }
        else {
            deferred.resolve(pools);
        }
    });
    return deferred.promise;
}

function findParticipateByUserId(poolId, userId) {
    var deferred = Q.defer();

    Pool.findOne({_id: poolId, 'participates.user': userId, 'participates.joined': true}, function (err, pool) {

        if (err) {
            deferred.reject(err);
        }
        else {
            if (pool && pool.participates) {
                deferred.resolve(pool.participates[0]);
            } else {
                deferred.resolve(null);
            }
        }
    });
    return deferred.promise;
}

function findGameById(poolId, gameId) {
    var deferred = Q.defer();

    Pool.findOne({_id: poolId, 'games': gameId}).populate({path: 'games', model: 'Game'}).exec(function (err, pool) {

        if (err) {
            deferred.reject(err);
        }
        else {
            if (pool && pool.games) {
                deferred.resolve(pool.games[0]);
            } else {
                deferred.resolve(null);
            }

        }
    });
    return deferred.promise;
}

function createPool(owner, name) {
    var deferred = Q.defer();
    var pool = new Pool({
        owner: owner,
        name: name
    });
    pool.save(function (err, doc) {
        if (err) {
            deferred.reject(new Error(err));
        }
        else {
            deferred.resolve(doc);
        }
    });
    return deferred.promise;
}


function addGames(poolId, games) {
    var deferred = Q.defer();

    var query = {
        _id: poolId
    };

    Pool.update(query, {$addToSet: {games: {$each: games}}}, function (err, doc) {
        if (err) {
            deferred.reject(new Error(err));
        }
        else {
            deferred.resolve(doc);
        }
    });
    return deferred.promise;
}

function addEvents(poolId, events) {
    var deferred = Q.defer();
    var query = {
        _id: poolId
    };

    Pool.update(query, {$addToSet: {events: {$each: events}}}, function (err, doc) {
        if (err) {
            deferred.reject(new Error(err));
        }
        else {
            deferred.resolve(doc);
        }
    });
    return deferred.promise;
}

function addInvitees(poolId, accounts) {
    var deferred = Q.defer();
    var query = {
        _id: poolId
    };

    Pool.update(query, {$addToSet: {invitees: {$each: accounts}}}, function (err, doc) {
        if (err) {
            deferred.reject(new Error(err));
        }
        else {
            deferred.resolve(doc);
        }
    });
    return deferred.promise;
}

function addParticipates(poolId, participates) {
    var deferred = Q.defer();
    var query = {
        _id: poolId
    };


    Pool.update(query, {$addToSet: {'participates': {$each: participates}}}, function (err, doc) {
        if (err) {
            deferred.reject(new Error(err));
        }
        else {
            deferred.resolve(doc);
        }
    });
    return deferred.promise;
}

module.exports = PoolRepository;
