'use strict';

module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);
    require('time-grunt')(grunt);

    grunt.initConfig({
        copy: {
            dist: {
                files: [{ expand: true, cwd: 'app/', src: ['**'], dest: 'dist/' }]
            }
        },
        jshint: {
            options: {
                jshintrc: true,
                reporter: require('jshint-stylish')
            },
            all: [
                'Gruntfile.js',
                'app/scripts/{,*/}*.js',
                'test/spec/{,*/}*.js'
            ]
        },
        connect: {
            test: {
                options: {
                    hostname: 'localhost',
                    port: 9500,
                    open: false,
                    base: ['test', 'app']
                }
            }
        },
        mocha: {
            all: {
                options: {
                    run: true,
                    urls: ['http://localhost:<%= connect.test.options.port %>/index.html'],
                    log: true,
                    reporter: 'Spec'
                }
            }
        },
        watch: {
            dist: {
                files: ['app/**/*'],
                tasks: ['copy'],
                options: {
                    interrupt: true
                }
            }
        }
    });

    grunt.registerTask('test', [
        'jshint',
        'connect:test',
        'mocha'
    ]);
};
