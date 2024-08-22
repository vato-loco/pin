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

var slots = {
    init: function () {
        this.btnSpin = $('.js-spin');
        this.reels = $('.js-reel');
        this.itemsPosition = [
            -9788,
            -9678,
            -9623, // win
        ];
        this.audioItem = new Audio('./audio/spin.mp3');
        this.audioWinItem = new Audio('./audio/spin-win.mp3');
        this.bulbsContainer = $('.js-bulbs');
        this.spinCount = 0;
        this.inSpin = false;

        this.bulbsContainer.addClass('slots__lightbulbs_default');
        this.bulbsAnimation = setInterval(function () {
            this.bulbsContainer.removeClass('slots__lightbulbs_default');
            setTimeout(function () {
                this.bulbsContainer.addClass('slots__lightbulbs_default');
            }.bind(this), 50);
        }.bind(this), 6150);

        this.events();
    },
    events: function () {
        var self = this;
        this.btnSpin.on('click', function () {
            if (!self.inSpin) {
                self.reset();
                setTimeout(function () {
                    self.spin();
                }, 20);
            }
        });
    },
    spin: function () {
        var self = this;
        this.inSpin = true;

        this.bulbsContainer.addClass('slots__lightbulbs_in-spin');

        this.bulbsAnimation = setInterval(function () {
            this.bulbsContainer.removeClass('slots__lightbulbs_in-spin');
            setTimeout(function () {
                this.bulbsContainer.addClass('slots__lightbulbs_in-spin');
            }.bind(this), 20);
        }.bind(this), 850);

        this.reels.attr('style', '');

        var slotsPosition = [2, 2, 2];

        if ( this.spinCount === 0 ) {
            slotsPosition = this.generateFailCombination();
        }

        this.reels.each(function (i) {
            self.reels.eq(i).css('bottom', self.itemsPosition[slotsPosition[i]]);
        });

        this.stopSound();

        if ( this.spinCount === 1 ) {
            this.playWinSound();
            setTimeout(function () {
                window.clearInterval(this.bulbsAnimation);
                this.bulbsContainer.attr('class', '').addClass('slots__lightbulbs slots__lightbulbs_before-message');
            }.bind(this), 6000);
            setTimeout(function () {
                quiz.init();
            }.bind(this), 6500);
        } else {
            this.playSound();
            setTimeout(function () {
                self.stopSound();
                self.inSpin = false;

                window.clearInterval(this.bulbsAnimation);

                this.bulbsContainer.removeClass('slots__lightbulbs_in-spin');

                setTimeout(function () {
                    this.bulbsContainer.addClass('slots__lightbulbs_default');
                }.bind(this), 20);

                this.bulbsAnimation = setInterval(function () {
                    this.bulbsContainer.removeClass('slots__lightbulbs_default');
                    setTimeout(function () {
                        this.bulbsContainer.addClass('slots__lightbulbs_default');
                    }.bind(this), 20);
                }.bind(this), 6150);

                this.btnSpin.text(this.btnSpin.data('text-for-repeat'));

                tracking.pushAfterSpin();
            }.bind(this), 4000);
        }

        this.spinCount++;
    },
    generateFailCombination: function () {
        var failCombination = [helpers.getRandomInteger(0, 2), helpers.getRandomInteger(0, 2), helpers.getRandomInteger(0, 2)];

        if ( (failCombination[0] === failCombination[1]) && (failCombination[0] === failCombination[2]) ) {
            var slotForChange = helpers.getRandomInteger(0, 2);

            if (failCombination[0] === 0) {
                failCombination[slotForChange] = helpers.getRandomInteger(1, 2);
            } else if (failCombination[0] === 1) {
                var availableCombinations = [0, 2];
                failCombination[slotForChange] = availableCombinations[helpers.getRandomInteger(0, 1)];
            } if (failCombination[0] === 2) {
                failCombination[slotForChange] = helpers.getRandomInteger(0, 1);
            }
        }

        return failCombination;
    },
    reset: function () {
        window.clearInterval(this.bulbsAnimation);
        this.bulbsContainer.removeClass('slots__lightbulbs_default');

        this.reels
            .css('transition', 'all 0s')
            .css('bottom', '0');
        this.inSpin = false;
    },
    playSound: function () {
        this.audioItem.play();
    },
    playWinSound: function() {
        this.audioWinItem.play();
    },
    stopSound: function () {
        this.audioItem.pause();
        this.audioItem.currentTime = 0;
        this.audioWinItem.pause();
        this.audioWinItem.currentTime = 0;
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
    slots.init();
    contactForm.init();
    tracking.init();
});

