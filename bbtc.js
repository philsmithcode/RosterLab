$(window).ready(function() {
    //#region Ready Core

        //Theme toggler
        document.querySelector(".theme-toggle").addEventListener("click",() => {
            toggleLocalStorage("dark");
            toggleRootClass();
        });

        //Sidebar toggler
        $("div.main").on("click", "#sidebar-toggle",function(){
            $("#sidebar").toggleClass("collapsed");
            let data = {'operation' : 'toggle-menu', 'app' : 'cross', 'action' : 'cross', 'data':{'hidden': $("#sidebar").hasClass("collapsed"), 'element':'sidebar'}};
            CallAjax(getAjaxEndpoint(), data);
        });

        //Menu collapse toggler
        $("#sidebar").on("click", "a.bb-menu-toggler",function(){
            let position = $(this).attr("data-bs-target").substring(1);
            let data = {'operation' : 'toggle-menu', 'app' : 'cross', 'action' : 'cross', 'data':{'hidden': $(this).hasClass("collapsed"), 'element':position}};
            CallAjax(getAjaxEndpoint(), data);
        });

        //initialize bootstrap-select
        $(".selectpicker").selectpicker();

        //destroy toast after hide
        $("body").on("hidden.bs.toast", ".toast",function(){
            $(this).remove();
        });

    //#endregion Core

    //#region Ready Team

        //Load player from selectpicker
        $("#playersTable tbody").on("changed.bs.select", "select.selectpicker" ,function(e, clickedIndex, isSelected, previousValue){
            if(clickedIndex === null)
                return;
            let positionId = $(this).parents('tr').attr("position");
            let playerId = $(this).val();
            let busy = {'area' : 'player-select', 'id' : $(this).attr('id')};
            let previous = {'area':'player-select', 'id' : $(this).attr('id'), 'value' : previousValue}
            
            if(!playerId || playerId == 0)
            {
                let data = {'operation' : 'delete-player', 'app' : 'team', 'action' : 'create', 'data':{'position': positionId}, 'busy' : busy, 'previous' : previous};
                CallAjax(getAjaxEndpoint(), data, refreshPlayerRow);
            }
            else
            {
                let data = {'operation' : 'add-player', 'app' : 'team', 'action' : 'create', 'data':{'position': positionId, 'playerId': playerId}, 'busy' : busy,  'previous' : previous};
                CallAjax(getAjaxEndpoint(), data, refreshPlayerRow);
            }
        });

        // change area value
        $("body").on("click", ".bb-operation", function(){
            let btn = $(this);
            let newValue = 0;
            let currentValue = btn.siblings(".bb-quantity").html();
            let maxValue = parseInt(btn.siblings(".bb-quantity").attr("data-bb-max"));
            let minValue = parseInt(btn.siblings(".bb-quantity").attr("data-bb-min"));
            let area = btn.parents("[data-bb-area]").attr("data-bb-area");

            let char = '';
            if(area == "attributes")
            {
                if (currentValue.slice(-1) == '+')
                {
                    currentValue = currentValue.slice(0, -1);
                    char = '+';
                }
            }

            currentValue = parseInt(currentValue);
            if((btn.hasClass("bb-add") && currentValue >= maxValue) ||
                (btn.hasClass("bb-substract") && currentValue <= minValue)){
                return;
            }
            
            if(btn.hasClass("bb-add"))
                newValue = currentValue + 1;
            else
                newValue = currentValue - 1;

            switch (area)
            {
                case 'attributes':
                    btn.siblings(".bb-quantity").html(newValue.toString()+char);
                    colorAttributes(btn.siblings(".bb-quantity"));
                    return;
                default:
                    let id = btn.parent().attr("data-bb-id");
                    let data = {'operation' : 'update-'+area+'-quantity', 'app' : 'team', 'action' : 'create', 'data':{'id': id, 'value': newValue, 'area': area}};
                    CallAjax(getAjaxEndpoint(), data, updateArea);
                    return;
            }
        });

        //change roster race
        $("#card-team").on("change", "#rosterRace", function(){
            window.$_GET = new URLSearchParams(location.search);
            let currentUrl = window.location.href;
            let slug = $(this).val();
            let spinner = $('<div class="spinner-border text-secondary float-end spinner-border-sm" style="margin-top: 0.25rem" role="status"></div>');
            spinner.append('<span class="visually-hidden">Loading...</span>');
            $('select#rosterRace').siblings('button').find('.filter-option-inner-inner').append(spinner);
            if($_GET.get('ruleset'))
                window.location.href = '/team/'+currentUrl.split("/")[4]+'/'+slug+'?ruleset='+$_GET.get('ruleset');
            else
            window.location.href = '/team/'+currentUrl.split("/")[4]+'/'+slug;
        });

        //change ruleset
        $("#card-team").on("change", "#ruleset", function(){
            window.$_GET = new URLSearchParams(location.search);
            let currentUrl = window.location.href;
            let rulesetId = $(this).val();
            let slug = $("#card-team #rosterRace").val()
            let spinner = $('<div class="spinner-border text-secondary float-end spinner-border-sm" style="margin-top: 0.25rem" role="status"></div>');
            spinner.append('<span class="visually-hidden">Loading...</span>');
            $('select#ruleset').siblings('button').find('.filter-option-inner-inner').append(spinner);
            if(rulesetId == 'BB2020_TOURNAMENT' || rulesetId == 'BB2025_DEFAULT')
                window.location.href = '/team/'+currentUrl.split("/")[4]+'/'+slug;
            else
                window.location.href = '/team/'+currentUrl.split("/")[4]+'/'+slug+'?ruleset='+rulesetId;
        });

        //Change special rule radiobutton
        $('#card-special-rules').on("changed.bs.select", 'select.selectpicker', function(e, clickedIndex, isSelected, previousValue) {
            selected_value = $(this).val();
            busy = {'area':'special-rules', 'id':$(this).attr('name')};
            previous = {'area':'special-rules', 'id':$(this).attr('name'), 'value':previousValue}
            let data = {'operation' : 'update-special-rule', 'app' : 'team', 'action' : 'create', 'data':{'rule': selected_value}, 'busy':busy, 'previous':previous};
            CallAjax(getAjaxEndpoint(), data, changeSpecialRuleResult)
        });

        //Update player get modal
        setPlayerModalHandler();

        //Update player confirm
        $("body").on("click", "#updatePlayerModal #btnUpdatePlayer" ,function(){
            let rosterPosition = $("#updatePlayerModal").attr("position");
            let attributes = {};
            //get attribute values
            attributes.MA = $("#updatePlayerModal tr[data-bb-id='MA'] .bb-quantity").html();
            attributes.ST = $("#updatePlayerModal tr[data-bb-id='ST'] .bb-quantity").html();
            attributes.AV = $("#updatePlayerModal tr[data-bb-id='AV'] .bb-quantity").html().slice(0, -1);
            attributes.PA = $("#updatePlayerModal tr[data-bb-id='PA'] .bb-quantity").html().slice(0, -1);
            attributes.AG = $("#updatePlayerModal tr[data-bb-id='AG'] .bb-quantity").html().slice(0, -1);

            let additionalSkills = $("#additional-skills select").val();
            let player ={
                attributes: attributes,
                additionalSkills: additionalSkills
            }
            let busy = {'area' : 'update-player-confirm', 'id' : $(this).attr('id')}
            let data = {'operation' : 'update-player', 'app' : 'team', 'action' : 'create', 'data':{'position': rosterPosition, 'player':player}, 'busy' : busy};
            CallAjax(getAjaxEndpoint(), data, updatePlayerResult);
        });

        //Update player modal - color attributes
        $("body").on("show.bs.modal", function(){
            $('#updatePlayerModal td.bb-quantity').each(function(){
                colorAttributes($(this));
            });
        });

        //Ruleset specific option change
        $("body").on("changed.bs.select", "#card-ruleset .selectpicker.bb-clickable", function(){
            let object = $(this).attr("id");
            let value = $(this).val();
            let data = {'operation' : 'ruleset-change', 'app' : 'team', 'action' : 'create', 'data':{'field': object, 'value':value}};
            CallAjax(getAjaxEndpoint(), data, rulesetChangeResult);
        });
        $("body").on("change", "#card-ruleset input[type='radio'].bb-clickable", function(){
            let object = $(this).attr("name");
            let value = $(this).val();
            let data = {'operation' : 'ruleset-change', 'app' : 'team', 'action' : 'create', 'data':{'field': object, 'value':value}};
            CallAjax(getAjaxEndpoint(), data, rulesetChangeResult);
        });


        //Save coach team and team name before generating PDF
        $('#pdf-form').on('submit', function() {
            let coachName = $('#card-team #coachName').val();
            let teamName = $('#card-team #teamName').val();
            $('#pdf-form #coach-name').val(coachName);
            $('#pdf-form #team-name').val(teamName);
            let currentAction =  $(this).attr('action').split("?")[0];
            $('#pdf-form').attr('action', currentAction+'?id='+Date.now());
            return true;
        });

        //Add players get modal
        $("#playersTable i.bb-add-players").on("click" ,function(e){
            let data = {'operation' : 'add-players-modal', 'app' : 'team', 'action' : 'create', 'data':{}};
            CallAjax(getAjaxEndpoint(), data, addPlayerSModalGetResult);
        });

        //Add players confirm
        $("body").on("click", "#addPlayersModal #btnAddPlayers" ,function(){
            let players = [];
            let options = $('#addPlayersModal').find('.selectpicker').toArray();
            options.forEach(element => {
                if($(element).val() > 0)
                {
                    players.push({'id':$(element).attr('name'), 'value':$(element).val()});
                }
            });
            if(players.length > 0)
            {
                let data = {'operation' : 'add-players', 'app' : 'team', 'action' : 'create', 'data':{'players': players}};
                CallAjax(getAjaxEndpoint(), data, addPlayersResult);
            }
        });

        //Generate PDF
        $("body form .btn-group a").on("click", function(){
            let buttonId = $(this).attr('id');
            $('#pdf-form #pdf-style').val(buttonId);
            $('#pdf-form').submit();
        });
        
    //#endregion Ready Team

    //#region Ready Roster

    //#region Ready My teams

            //Edit team
            $("#myTeamsTable tbody").on("click", "tr td:not(.bb-actions)" ,function(){
                let teamSlug = $(this).parents("tr").attr("bb-team-slug");
                window.location.href = window.location.href + "/edit/"+teamSlug;
            });

            //Display team
            $("#myTeamsTable tbody").on("click", "tr td.bb-actions .bi-search" ,function(){
                let teamSlug = $(this).parents("tr").attr("bb-team-slug");
                window.location.href = window.location.href + "/details/"+teamSlug;
            });

            //Delete team
            $("#myTeamsTable tbody").on("click", "tr td.bb-actions .bi-trash3" ,function(){
                let teamSlug = $(this).parents("tr").attr("bb-team-slug");
                let teamName = $(this).parents("tr").children(":nth-child(2)").html();
                let options = {'header':'Delete team', 'body':'Do you want to delete team '+teamName+'?', 'cancel':'Cancel', 'accept':'Delete', 'callback':'deleteTeam', 'parameter':teamSlug};
                displayModal(options);
            });

            //Copy team
            $("#myTeamsTable tbody").on("click", "tr td.bb-actions .bi-copy" ,function(){
                let teamSlug = $(this).parents("tr").attr("bb-team-slug");
                let data = {'operation' : 'copy-team', 'app' : 'team', 'action' : 'my-list', 'data':{'slug': teamSlug}};
                CallAjax(getAjaxEndpoint(), data);
            });

    //#endregion Ready My teams

    //#region Ready Tournament List   

            //Delete tournament
            $("#myTournamentsTable tbody").on("click", "tr td.bb-actions .bi-trash3" ,function(){
                let tournamentId = $(this).parents("tr").attr("bb-tournament-id");
                let data = {'operation' : 'delete-tournament', 'app' : 'tournament', 'action' : 'list', 'data':{'tournament_id': tournamentId}};
                CallAjax(getAjaxEndpoint(), data);
            });

            //Edit tournament
            $("#myTournamentsTable tbody").on("click",  "tr td:not(.bb-actions)" ,function(){
                let tournamentId = $(this).parents("tr").attr("bb-tournament-id");
                window.location.href = window.location.href + '/' + tournamentId;
            });
            
    //#endregion Ready Tournament List

    //#region Ready Tournament Details
            // $("#card-tournamentLocation").on("change", "#checkUseMap", function(){
            //     $('.map-container').toggleClass('d-none');
            // });

            //Generate PDF
            $("#participantsTable").on("click", "td.bb-actions .bi-filetype-pdf", function(){
                let teamSlug = $(this).parents("tr").attr("bb-team-slug");
                $('#pdf-form-tournament').find("input[name='id'").attr("value", Date.now());
                $('#pdf-form-tournament').attr('action', '/pdf/team/'+teamSlug);
                $("#pdf-form-tournament").submit();
                return true;
            });

            //Details roster
            $("#participantsTable").on("click", "td.bb-actions .bi-search", function(){
                let teamSlug = $(this).parents("tr").attr("bb-team-slug");
                $('#pdf-form-tournament').find("input[name='id'").attr("value", Date.now());
                $('#pdf-form-tournament').attr('action', '/team/details/'+teamSlug);
                $("#pdf-form-tournament").submit();
                return true;
            });

            //Delete roster
            $("#participantsTable").on("click", "td.bb-actions .bi-trash3", function(){
                let teamId = $(this).parents("tr").attr("bb-team-id");
                let data = {'operation' : 'delete-team', 'app' : 'tournament', 'action' : 'details', 'data':{'team_id': teamId}};
                CallAjax(getAjaxEndpoint(), data, deleteTeamResult);
            });

            //Validate rosters
            $("#validation-btn-group").on("click", "a.dropdown-item", function(){
                let validateOption = $(this).attr("id");
                let teamsRows = $("#participantsTable tbody").children("tr");
                let teams = [];
                for(let i = 0; i<teamsRows.length; i++){
                    if(validateOption == 'validate-not-validated')
                    {
                        if($(teamsRows[i]).find(".bb-validation").hasClass("bi-check-circle"))
                            continue;
                    }
                    teams.push($(teamsRows[i]).attr("bb-team-slug"));
                };
                let data = {'operation' : 'validate-teams', 'app' : 'tournament', 'action' : 'details', 'data':{'option': validateOption, 'teams': teams}};
                CallAjax(getAjaxEndpoint(), data, validateTeamsResult);
            });
    //#endregion Ready Tournament Details

    //#region Ready User

        //Delete User
        $("#card-user #btn-delete-user").on("click", function(){
            console.log($(this).parents("tr").children(":nth-child(2)").html());
            let options = {'header':'Delete account', 'body':'Do you want to delete your account?', 'accept':'Delete account', 'cancel':'Cancel', 'callback':'deleteUser'};
            displayModal(options);
        });

    //#endregion Ready User

    //switch favourite roster list
    $("#accordionRosterList").on("click", ".accordion-button i" ,function(e){
        let rosterId = $(this).parent("span").attr("roster-id");
        let toAdd = $(this).hasClass("bi-star"); //true - need to insert favourite, false - need to delete
        let data = {'operation' : 'switch-favourite-roster', 'app' : 'roster', 'action' : 'list', 'data':{'rosterId': rosterId, 'toAdd': toAdd}};
        CallAjax(getAjaxEndpoint(), data, switchFavouriteRoster);
    });

    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))

    //change Resources
    $("#resource-card").on("changed.bs.select", ".selectpicker" ,function(event, clickedIndex, isSelected, previousValue){
        window.location.href = $(this).val();
    });



//#endregion Ready Core    

});



//#region Core

    //#region Ajax
        var ajaxQueue = {
            queue: [],
            currentRequest: undefined,
            addRequest: function(requestData){
                this.queue.push(requestData);
                if(this.queue.length === 1)
                    this.run();
            },
            clearQueue: function(){
                this.queue = [];
                this.current = undefined;
            },
            run: function(){
                let request = this.queue[0];
                if(request)
                {
                    this.currentRequest = request;
                    this.startBusy(request.parameters.busy);
                    startAjax(request.url, request.parameters, request.successCallback);
                }
            },
            completeRequest: function(){
                this.queue.shift();
                this.stopBusy();
                this.currentRequest = undefined;
                this.run();
            },
            startBusy: function(request){
                if(request)
                {
                    let spinner;
                    let target;
                    switch(request.area)
                    {
                        case 'player-select':
                            spinner = $('<div class="spinner-border text-secondary float-end spinner-border-sm" style="margin-top: 0.25rem" role="status"></div>');
                            spinner.append('<span class="visually-hidden">Loading...</span>');
                            target = $('#'+request.id).siblings("button").find(".filter-option-inner-inner");
                            break;
                        case 'update-player-confirm':
                            spinner = $(' <span class="spinner-border ms-2 text-light float-end spinner-border-sm" style="margin-top: 0.25rem" role="status"></div>');
                            spinner.append(' <span class="visually-hidden">Loading...</span>');
                            target = $('#'+request.id);
                            break;
                        case 'modal-update':
                            spinner = $(' <span class="spinner-border text-secondary float-end spinner-border-sm" style="margin-top: 0.25rem" role="status"></div>');
                            spinner.append(' <span class="visually-hidden">Loading...</span>');
                            target = $('#playersTable').find('tr[position="'+request.id+'"]').find("button").find(".filter-option-inner-inner");
                            break;
                        case 'special-rules':
                            spinner = $('<div class="spinner-border text-secondary float-end spinner-border-sm" style="margin-top: 0.25rem" role="status"></div>');
                            spinner.append('<span class="visually-hidden">Loading...</span>');
                            target = $('#card-special-rules .selectpicker[name="'+request.id+'"]').siblings('button').find('.filter-option-inner-inner');
                            break;
                        case 'validate':
                            spinner = $(' <span class="spinner-border ms-2 text-light float-end spinner-border-sm" style="margin-top: 0.25rem" role="status"></div>');
                            spinner.append(' <span class="visually-hidden">Loading...</span>');
                            target = $('#'+request.id);
                            break;
                    }
                    target.append(spinner);
                }
                    
            },
            stopBusy: function(){
                $(".spinner-border").remove();
            },
            setPreviousValue: function(){
                if(this.currentRequest.parameters.previous)
                {
                    let previous = this.currentRequest.parameters.previous;
                    switch(previous.area)
                    {
                        case 'player-select':
                            $('#'+previous.id).selectpicker('val', previous.value);
                            break;
                        case 'special-rules':
                            $('#card-special-rules .selectpicker[name="'+previous.id+'"]').selectpicker('val',  previous.value);
                            break;
                    }
                }
            }
        }

        function startAjax(url, parameters, successCallback)
        {
            var toastOptions = [];
            $.ajax({
                type: 'POST',
                url: url,
                data: {data: JSON.stringify(parameters)},
                timeout: 15000,
                success: function(data, textStatus, jqXHR) {
                    try
                    {
                        data = JSON.parse(data);
                    }
                    catch(e)
                    {
                        toastOptions.message = "Oops, something went wrong";
                        toastOptions.title = "Communication error";
                        showToast(toastOptions);
                        ajaxQueue.setPreviousValue();
                        console.warn("Status: "+textStatus.toString()+" Response: "+jqXHR.responseText.toString())
                        ajaxQueue.completeRequest();
                        return;
                    }
                    
                    if(typeof data.error != "undefined")
                    {
                        toastOptions.message = "Oops, something went wrong\n"+data.error.message;
                        toastOptions.title = "Communication error";
                        showToast(toastOptions);
                        ajaxQueue.setPreviousValue();
                        if(data.error.console)
                            console.warn(data.error.console[0].toString())
                        ajaxQueue.completeRequest();
                    }
                    else
                    {
                        if(data.redirect)
                        {
                            ajaxQueue.clearQueue();
                            window.location.href = data.redirect;
                            exit();
                        }
                        if(data.toast)
                            showToast(data.toast.options);
                        if(data.modal)
                            displayModal(data.modal);
                        if(data.console)
                            console.log(data.console);
                        if(successCallback)
                            successCallback(data.data);
                        ajaxQueue.completeRequest();
                    }
                },
                error: function(xhr, textStatus, errorThrown) {              
                    toastOptions.message = "Oops, something went wrong. Try again.";
                    toastOptions.title = "Communication error";
                    showToast(toastOptions);
                    console.warn("Status: "+textStatus.toString()+" Error: "+errorThrown.toString());
                    ajaxQueue.setPreviousValue();
                    ajaxQueue.completeRequest();
                },
            });
        }

        function CallAjax(url, parameters, successCallback)
        {
            let data = {};
            data.url = url;
            data.parameters = parameters;
            data.successCallback = successCallback;
            ajaxQueue.addRequest(data);
        }

    //#endregion Ajax

    function showToast(options)
    {
        let toast = $('<div/>')
            .addClass("toast")
            .attr("role", "alert")
        let toastHeader = $("<div/>")
            .addClass("toast-header")
        let headerTitle = $("<strong/>")
            .addClass("me-auto")
            .html(options.title)
        let headerTime = $("<small/>")
            .html("just now");
        let buttonClose = $("<button/>")
            .attr("type", "button")
            .attr("data-bs-dismiss", "toast")
            .addClass("btn-close");
        let toastBody = $("<div/>")
            .addClass("toast-body")
            .css("white-space", "pre-wrap")
            .html(options.message.toString())

        toastHeader.append(headerTitle).append(headerTime).append(buttonClose);
        toast.append(toastHeader).append(toastBody);

        toast.appendTo($(".toast-container"));

        let bootstrapToast = bootstrap.Toast.getOrCreateInstance(toast);
        bootstrapToast.show();
    }

    function displayModal(options)
    {
        console.log(options);
        $('#bb-generic-modal').remove();
        let header = options.header ?? "Confirm action";
        let body = options.body ?? "??";
        let cancel = options.cancel ?? false;
        let accept = options.accept ?? false;
        let callback = options.callback ?? "";
        let parameter = options.parameter ?? "";
        let modalHtml = '\
        <div class="modal" tabindex="-1" id="bb-generic-modal">\
            <div class="modal-dialog">\
                <div class="modal-content">\
                    <div class="modal-header">\
                        <h5 class="modal-title">'+header+'</h5>\
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>\
                    </div>\
                    <div class="modal-body">\
                        <p>'+body+'</p>\
                    </div>\
                    <div class="modal-footer py-1">';
                    if(cancel !== false)
                        modalHtml = modalHtml + '\<button type="button" class="btn border border-2 border-radius-3" data-bs-dismiss="modal">'+cancel+'</button>';
                    if(accept !== false)
                        modalHtml = modalHtml + '\<button type="button" class="btn btn-secondary" onclick="'+callback+'(\''+parameter+'\')">'+accept+'</button>';
        modalHtml = modalHtml + '\
                    </div>\
                </div>\
            </div>\
        </div>'

        $('body').append(modalHtml);
        let modal = new bootstrap.Modal('#bb-generic-modal');
        modal.show();
    }

//#endregion Core

//#region Roster

    function switchFavouriteRoster(data)
    {
        $("#accordionRosterList span[roster-id='"+data.rosterId+"']").find("i").toggleClass("bi-star bi-star-fill");
        $("div.favourite-wrapper").html(data['html']);
    }

//#endregion Roster

//#region Team

    function saveTeam()
    {
        let coachName = $('#card-team  input#coachName').val().toString().trim();
        let teamName = $('#card-team  input#teamName').val().toString().trim();

        let data = {'operation' : 'save-team', 'app' : 'team', 'action' : 'create', 'data':{'coachName': coachName, 'teamName': teamName}};
        CallAjax(getAjaxEndpoint(), data);
    }

    function updateTeam()
    {
        let coachName = $('#card-team  input#coachName').val().toString().trim();
        let teamName = $('#card-team  input#teamName').val().toString().trim();

        let data = {'operation' : 'update-team', 'app' : 'team', 'action' : 'edit', 'data':{'coachName': coachName, 'teamName': teamName}};
        CallAjax(getAjaxEndpoint(), data);
    }

    function validateTeam()
    {
        let path = window.location.pathname;
        let mode = path.split("/")[2];
        let busy = {'area' : 'validate', 'id':'button-validate'};
        let data = {'operation' : 'validate-team', 'app' : 'team', 'action' : 'create', 'data':{'mode': mode}, 'busy' : busy};
        CallAjax(getAjaxEndpoint(), data);
    }

    function refreshPlayerRow(data)
    {
        for(let i = 1; i <= 16; i++){
            if(data['positions'][i])
            {
                let tr = $('#playersTable tr[position="'+i+'"]');
                tr.replaceWith(data['positions'][i]['html']);
                let newTr = $('#playersTable tr[position="'+i+'"]');
                $(newTr).find('.selectpicker').selectpicker();
            }
        }
        
        if(data['cost'])
            refreshCost(data['cost']);
    }

    function refreshCost(data)
    {
        $("#card-teamValue tbody").html(data);   
    }

    function changeSpecialRuleResult(data)
    {
        
        //update players
        refreshPlayerRow(data);
        //update inducements
        let table = $('#inducementsTable tbody');
        table.html(data['inducements']['html']);
        //update cost
        if(data['cost'])
            refreshCost(data['cost']);
        if(data['specialRules'])
        {
            
            let specialRulesCard = $('#card-special-rules .card-body');
            console.log(data['specialRules']['html']);
            specialRulesCard.html(data['specialRules']['html']);
            specialRulesCard.find('.selectpicker').selectpicker();
        }
    }

    function updateArea(data)
    {
        let tr = $('#'+data['area']+'Table').find("tbody tr[data-bb-id='"+ data['id'] +"']");
        let cellQuantity = tr.find("td.bb-quantity");
        let cellSum = tr.find("td.bb-sum");
        cellQuantity.html(data['value']);
        cellSum.html(data['sum']);
        if(data['cost'])
            refreshCost(data['cost']);
    }

    function updatePlayerModalGetResult(data)
    {
        //remove previous modal
        $('#updatePlayerModal').remove();
        //add modal to html body
        $(data['html']).appendTo('#modal-wrapper');
        //initiate additional skills select
        $('.selectpicker').selectpicker();
        //initiate bootstrap modal
        let modal = new bootstrap.Modal('#updatePlayerModal');
        modal.show();
        setPlayerModalHandler();
    }

    function setPlayerModalHandler()
    {
        $("#playersTable tbody").on("click", "tr.bb-player-row td:not(.bb-player-select)" ,function(e){
            let position = $(this).parents("tr").attr("position");
            let busy = {'area' : 'modal-update', 'id' : position};
            let data = {'operation' : 'update-player-modal', 'app' : 'team', 'action' : 'create', 'data':{'position': position}, 'busy' : busy};
            $("#playersTable tbody").off("click", "tr.bb-player-row td:not(.bb-player-select)");
            CallAjax(getAjaxEndpoint(), data, updatePlayerModalGetResult);
        });
    }

    function updatePlayerResult(data)
    {
        let modal = bootstrap.Modal.getInstance('#updatePlayerModal');
        refreshPlayerRow(data);
        if(data['cost'])
            refreshCost(data['cost']);
        modal.hide();
    }

    function colorAttributes(td)
    {
        let value = $(td).html();
        if($(td).html() == '-')
            return;
        if ($(td).html().slice(-1) == '+')
        {
            value = parseInt($(td).html().slice(0, -1));
        }
        if(value == parseInt($(td).attr('data-bb-base')))
        {
            $(td).removeClass('bb-below');
            $(td).removeClass('bb-above');
            return;
        }
        let attr = $(td).closest('tr').attr('data-bb-id');
        if(attr == 'AG' || attr == 'PA')
        {
            if(value < parseInt($(td).attr('data-bb-base')))
            {
                $(td).addClass('bb-above');
                return;
            }
            else if(value > parseInt($(td).attr('data-bb-base')))
            {
                $(td).addClass('bb-below');
                return;
            }
        }
        else
        {
            if(value > parseInt($(td).attr('data-bb-base')))
            {
                $(td).addClass('bb-above');
                return;
            }
            else if(value < parseInt($(td).attr('data-bb-base')))
            {
                $(td).addClass('bb-below');
                return;
            }
        }       
    }

    function rulesetChangeResult(data)
    {
        if(data['card-ruleset'])
        {
            $("#card-ruleset").find(".card-body").html(data['card-ruleset']['html']);
            $("#card-ruleset").find(".selectpicker").selectpicker();
        }
        if(data['card-teamValue'])
            $("#card-teamValue").find(".card-body tbody").html(data['card-teamValue']['html']);
            
        if(data['positions'])
            refreshPlayerRow(data);
    }

    function addPlayerSModalGetResult(data)
    {
        //remove previous modal
        $('#addPlayersModal').remove();
        //add modal to html body
        $(data['html']).appendTo('#modal-wrapper');
        //initiate additional skills select
        $('#addPlayersModal .selectpicker').selectpicker();
        //initiate bootstrap modal
        let modal = new bootstrap.Modal('#addPlayersModal');
        modal.show();
    }

    function addPlayersResult(data)
    {
        let modal = bootstrap.Modal.getInstance('#addPlayersModal');
        refreshPlayerRow(data);
        if(data['cost'])
            refreshCost(data['cost']);
        modal.hide();
    }

//#endregion Team

//#region My teams

    function deleteTeam(slug)
    {
        let data = {'operation' : 'delete-team', 'app' : 'team', 'action' : 'my-list', 'data':{'slug': slug}};
        CallAjax(getAjaxEndpoint(), data);
    }

//#endregion My teams

//#region User

    function deleteUser()
    {
        let data = {'operation' : 'delete-user', 'app' : 'user', 'action' : 'account', 'data':{}};
        CallAjax(getAjaxEndpoint(), data);
    }

//#endregion User

//#region Tournament Details
    // async function initMap() {
    //     const { Map } = await google.maps.importLibrary("maps");
    //     const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    //     //default location
    //     let pos = {
    //         lat: 52.11625097289976,
    //         lng: 19.512887075437895,
    //     }
    //     let zoom = 1;
    //     let marker = null;
    //     //create map
    //     const map = new Map(document.getElementById("map"), {
    //         zoom: zoom,
    //         center: pos,
    //         mapId: "DEMO_MAP_ID",
    //         zoomControl: true,
    //         cameraControl: false,
    //         mapTypeControl: true,
    //         mapTypeControlOptions: {
    //             style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
    //             mapTypeIds: [google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.ROADMAP]
    //         },
    //         scaleControl: false,
    //         streetViewControl: false,
    //         rotateControl: false,
    //         fullscreenControl: true
    //     });
    //     //create button to find location
    //     const locationButton = document.createElement("button");
    //     locationButton.innerHTML = '<i class="bi bi-crosshair">';
    //     locationButton.classList.add("custom-map-control-button");
    //     map.controls[google.maps.ControlPosition.TOP_CENTER].push(locationButton);
    //     locationButton.addEventListener("click", () => {
    //         if (navigator.geolocation)
    //         {
    //             navigator.geolocation.getCurrentPosition(
    //                 (position) => {
    //                     const pos = {
    //                         lat: position.coords.latitude,
    //                         lng: position.coords.longitude,
    //                     };
    //                     map.setCenter(pos);
    //                     map.setZoom(10);
    //                 }
    //             )
    //         }    
    //     });
    //     //event to create markers  
    //     map.addListener("click", (mapsMouseEvent) => {
    //         let positionLat = mapsMouseEvent.latLng.lat();
    //         let positionLng = mapsMouseEvent.latLng.lng();
    //         //delete previous marker
    //         if(marker != null)
    //             marker.map = null;
    //         //add new marker
    //         marker = new AdvancedMarkerElement({
    //             map,
    //             position: { lat: positionLat, lng: positionLng },
    //         });
    //     });
    // }

    function deleteTeamResult(data)
    {
        if(data['html'])
        {
            $("#participantsTable tbody").html(data['html']);
        }
    }

    function validateTeamsResult(data)
    {
        if(data)
        {
            let mark = $("#participantsTable tbody").find(".bb-validation-result");
            for(let i = 0; i<mark.length; i++)
                mark[i].remove();
            Object.keys(data).forEach(function(key){
                let tr = $("#participantsTable tbody").find("[bb-team-id='"+key+"']");
                let span = $(tr).find(".bb-validation");
                setValidationIcon(span, data[key]);
            });
        }
    }

    function setValidationIcon(obj, validationStatus)
    {
        switch(validationStatus.is_valid)
        {
            
            case 1:
                let messagesText = '';
                Object.keys(validationStatus.messages).forEach(function(key){
                    messagesText += validationStatus.messages[key];
                    messagesText += "<br>";
                });
                obj.attr("class", "bb-validation bi bi-ban");
                obj.attr("data-bs-toggle","popover");
                obj.attr("data-bs-trigger", "hover focus");
                obj.attr("data-bs-content", messagesText);
                obj.attr("data-bs-title", "Team is not correct");
                obj.attr("data-bs-html", "true");
                break;
            case 2:
                obj.attr("class", "bb-validation bi bi-check-circle");
                obj.attr("data-bs-toggle","popover");
                obj.attr("data-bs-trigger", "hover focus");
                obj.attr("data-bs-content", "No errors");
                obj.attr("data-bs-title", "Team is correct");
                break;
        }
        obj.after('<span class="bb-validation-result bi bi-exclamation-lg"></span>');
        initiatePopovers();
    }

    function initiatePopovers()
    {
        let popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
        let popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
    }
//#endregion Tourmanent Details