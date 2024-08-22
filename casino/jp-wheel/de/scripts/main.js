var contactForm = {
    init: function () {
        this.form = $('.js-contact-form');
        this.submit = $('.js-contact-form-submit');
        this.fieldEmail = $('input[name="email"]');
        this.fieldName = $('input[name="name"]');
        this.fieldMessage = $('textarea[name="message"]');
        this.result = $('.js-contact-form-result');
        this.events();
    },
    events: function () {
        var self = this;
        this.form.on('submit', function (e) {
            e.preventDefault();

            if (!self.inSending) {
                self.submit.text('Sending ...');
                self.inSending = true;

                var message = "<b>Name:</b> " + self.fieldName.val() + '<br><br>';
                message += "<b>Message:</b> " + self.fieldMessage.val();

                Email.send({
                    SecureToken: "ddaa6158-c224-4bd5-8b43-d65179e23ae4",
                    To: 'noah@finomedia.de',
                    From: self.fieldEmail.val(),
                    Subject: "Email from JackpotNow",
                    Body: message
                }).then(
                    function (message) {
                        self.submit.text('Send');
                        self.inSending = false;
                        self.result.fadeIn(500);

                        if (message === 'OK') {
                            $('.js-contact-form')[0].reset();
                            self.result
                                .text('Email was successfully sent!')
                                .removeClass('contact-form__result_fail')
                                .addClass('contact-form__result_success');
                        } else {
                            self.result
                                .text(message)
                                .removeClass('contact-form__result_success')
                                .addClass('contact-form__result_fail');
                        }
                    }
                );
            }
        });
    }
};

var wheel = {
    init: function () {
        this.btnSpin = $('.js-wheel-spin');
        this.circle = $('.js-wheel-circle');
        this.bulbs = $('.js-wheel-bulbs');
        this.inSpin = false;
        /*this.audioItemSpin = $('.js-audio-spin');
        this.audioItemWin = $('.js-audio-win');*/
        this.audioItemSpin = new Audio('./audio/sound-spin.mp3');
        this.audio = new Audio('./audio/sound.mp3');
        // this.audioItemSpin.load();
        this.audioItemWin = new Audio('./audio/sound-win.mp3');
        // this.audioItemWin.load();
        this.spinsCount = 0;
        this.config = {
            numbers: 8,
            rotations: 15,
            duration: 5,
            animation: 'ease',
            prizes: [
                'Mega Bonus Pack 🎉',
                '50% Bonus',
                '50 Spins',
                'Nochmal versuchen',
                '90€ Cash',
                '50€ Cash',
                '50 Spins',
                'Nochmal versuchen',
            ]
        };

        this.events();
    },
    events: function () {
        var self = this;
        this.btnSpin.on('click', function () {
            if (!self.inSpin) {
                var sector = 7;
                if (self.spinsCount >= 1) {
                    sector = 0;
                }

                var unitDeg = 360 / self.config.numbers,
                    targetDeg = unitDeg * sector,
                    offset = (360 / self.config.numbers) / 2,
                    finalDeg = (self.config.rotations * 360 + targetDeg + offset);

                console.log('Current sector ' + sector);

                self.reset();

                setTimeout(function() {
                    self.rotate(finalDeg, self.config.duration, self.config.animation, sector);
                }, 100);

                setTimeout(function() {
                    if (sector !== 3 && sector !== 7) {
                        quiz.init();
                    } else {
                        tracking.pushAfterSpin();
                    }
                }, self.config.duration * 1000 + 1000);

                self.spinsCount++;
            }
        });
    },
    rotate: function(finalDeg, duration, animation, sector) {
        this.stopSound();
        this.playSound();

        this.bulbs.addClass('wheel__bulbs_in-spin');

        this.circle
            .css("transition", "transform " + duration + "s " + animation)
            .css('transform','rotate(' + finalDeg + 'deg)');

        this.inSpin = true;

        var self = this;

        setTimeout(function() {
            self.audio.pause();
            self.bulbs.removeClass('wheel__bulbs_in-spin');

            if (sector !== 3 && sector !== 7) {
                self.bulbs.addClass('wheel__bulbs_before-message');
                self.playSound();
            } else {
                self.inSpin = false;
            }
        }, duration * 1000 );

        setTimeout(function() {
            self.bulbs.removeClass('wheel__bulbs_before-message');
        }, duration * 1000 + 1000);
    },
    reset: function () {
        this.circle.attr('style', '');
        this.inSpin = false;
    },
    playSoundSpin: function () {
        this.audioItemSpin.play().then();
    },
    playSoundWin: function () {
        this.audioItemWin.play().then();
    },
    playSound: function() {
        this.audio.play();
    },
    stopSound: function () {
        this.audio.pause();
        this.audio.currentTime = 0;
        /*this.audioItemSpin.pause();
        this.audioItemSpin.currentTime = 0;
        this.audioItemWin.pause();
        this.audioItemWin.currentTime = 0;*/
    }
};

var quiz = {
    init: function () {
        $('.main, .intro').fadeOut(500);
        setTimeout(function () {
            $('.last-stage').fadeIn(500);
        }.bind(this), 500);

        this.block = $('.js-quiz');
        if ( this.block.length > 0 ) {
            this.steps = $('[data-quiz-step]');
            this.btnNextStep = $('.js-quiz-next-step');
            this.currentStep = 0;
            this.currentStepLabel = $('.js-quiz-current-step');
            this.openStep(1);

            this.events();
        }
    },
    events: function () {
        this.btnNextStep.on('click', function () {
            this.openStep(this.currentStep + 1)
        }.bind(this));
    },
    openStep: function (step) {
        this.steps.hide();
        this.steps.eq(step-1).fadeIn(1000);
        this.currentStep = step;
        this.currentStepLabel.text( (step <= 4) ? step : 4 );
    }
};

var helpers = {
    getRandomInteger: function (min, max) {
        var rand = min - 0.5 + Math.random() * (max - min + 1);
        rand = Math.round(rand);
        return rand;
    }
};

var tracking = {
    init: function () {
        this.TIMEOUT_IN_SECONDS = 10;
        this.pushAfterTimeout(this.TIMEOUT_IN_SECONDS);
    },
    pushToTrackerViaImage: function(eventNubmer){
        var pushURL = 'https://t.jackpotnow.net/click.php?event' + eventNubmer + '=1';
        var img = document.createElement('img');
        img.src=pushURL;
        img.style.display='none';
        document.body.appendChild( img );
    },
    pushAfterTimeout: function(timeout){
        setTimeout(this.pushToTrackerViaImage.bind(null, 7), timeout*1000);
    },
    pushAfterSpin: function () {
        this.pushToTrackerViaImage(5);
    }
};


$(function () {
    wheel.init();
    contactForm.init();
    tracking.init();
});

