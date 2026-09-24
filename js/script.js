/* ========================================
   CONFIGURAÇÃO
======================================== */

const ANO = 2027;


/* ========================================
   ANIVERSÁRIOS
======================================== */

const aniversarios = [

    {
        nome: "Tchayel",
        dia: 5,
        mes: 3
    },

    {
        nome: "Seventh",
        dia: 14,
        mes: 3
    },

    {
        nome: "Heduine",
        dia: 27,
        mes: 4
    },

    {
        nome: "Vida",
        dia: 7,
        mes: 8
    },

    {
        nome: "Nagy",
        dia: 3,
        mes: 11
    },

    {
        nome: "Davi",
        dia: 30,
        mes: 11
    },

    {
        nome: "Mizaela",
        dia: 30,
        mes: 12
    }

];


/* ========================================
   MEMÓRIAS
======================================== */

const memorias = [

    {
        nome: "Pedido",
        dia: 1,
        mes: 7
    },

    {
        nome: "Casamento",
        dia: 8,
        mes: 8
    }

];


/* ========================================
   MESES
======================================== */

const meses = [

    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"

];


const diasSemana = [

    "SEG",
    "TER",
    "QUA",
    "QUI",
    "SEX",
    "SÁB",
    "DOM"

];


/* ========================================
   CRIAR CALENDÁRIO
======================================== */

function criarMes(numeroMes) {

    const primeiroDia =
        new Date(
            ANO,
            numeroMes,
            1
        );


    const totalDias =
        new Date(
            ANO,
            numeroMes + 1,
            0
        ).getDate();


    /*
        JavaScript começa domingo = 0.

        Aqui transformamos:
        domingo → 6
        segunda → 0
    */

    const inicio =
        (primeiroDia.getDay() + 6) % 7;


    let html = `

        <div class="month">

            <div class="month-header">

                <span>
                    ${meses[numeroMes]}
                </span>

                <span>
                    ${ANO}
                </span>

            </div>


            <div class="weekdays">

                ${diasSemana.map(
                    dia => `<span>${dia}</span>`
                ).join("")}

            </div>


            <div class="days">

    `;


    /* espaços antes do primeiro dia */

    for(let i = 0; i < inicio; i++){

        html += `
            <div class="day empty"></div>
        `;

    }


    /* dias */

    for(
        let dia = 1;
        dia <= totalDias;
        dia++
    ){

        const aniversario =
            encontrarAniversario(
                numeroMes + 1,
                dia
            );


        const memoria =
            encontrarMemoria(
                numeroMes + 1,
                dia
            );


        const hoje =
            verificarHoje(
                numeroMes,
                dia
            );


        let classes = "day";


        if(aniversario){

            classes += " birthday";

        }


        if(memoria){

            classes += " memory";

        }


        if(hoje){

            classes += " today";

        }


        let titulo = "";


        if(aniversario){

            titulo =
                `Aniversário de ${aniversario.nome}`;

        }


        if(memoria){

            titulo +=
                ` ${memoria.nome}`;

        }


        html += `

            <div
                class="${classes}"
                title="${titulo}"
            >

                ${dia}

                ${
                    aniversario || memoria
                    ? `<span class="dot"></span>`
                    : ""
                }

            </div>

        `;

    }


    html += `

            </div>

        </div>

    `;


    return html;

}



/* ========================================
   VERIFICAR ANIVERSÁRIO
======================================== */

function encontrarAniversario(
    mes,
    dia
){

    return aniversarios.find(
        pessoa =>
            pessoa.mes === mes &&
            pessoa.dia === dia
    );

}



/* ========================================
   VERIFICAR MEMÓRIA
======================================== */

function encontrarMemoria(
    mes,
    dia
){

    return memorias.find(
        memoria =>
            memoria.mes === mes &&
            memoria.dia === dia
    );

}



/* ========================================
   VERIFICAR HOJE
======================================== */

function verificarHoje(
    mes,
    dia
){

    const hoje = new Date();


    return (

        hoje.getFullYear() === ANO &&

        hoje.getMonth() === mes &&

        hoje.getDate() === dia

    );

}



/* ========================================
   MOSTRAR TODOS OS MESES
======================================== */

function carregarCalendario(){

    const container =
        document.getElementById("months");


    container.innerHTML = "";


    for(
        let mes = 0;
        mes < 12;
        mes++
    ){

        container.innerHTML +=
            criarMes(mes);

    }

}



/* ========================================
   ANIVERSÁRIOS
======================================== */

function carregarAniversarios(){

    const lista =
        document.getElementById(
            "birthdayList"
        );


    lista.innerHTML = "";


    aniversarios.forEach(
        pessoa => {

            lista.innerHTML += `

                <div class="event">

                    <span class="event-dot"></span>

                    <span>

                        <strong>
                            ${pessoa.dia}
                            de
                            ${meses[pessoa.mes - 1]}
                        </strong>

                        —
                        ${pessoa.nome}

                    </span>

                </div>

            `;

        }
    );


    /* cards */

    const cards =
        document.getElementById(
            "birthdayCards"
        );


    cards.innerHTML = "";


    aniversarios.forEach(
        pessoa => {

            cards.innerHTML += `

                <div class="birthday-card">

                    <div class="avatar">

                        ${pessoa.nome
                            .charAt(0)
                            .toUpperCase()
                        }

                    </div>

                    <h3>
                        ${pessoa.nome}
                    </h3>

                    <p>
                        Aniversário da
                        Família Barroso
                    </p>

                    <span class="date">

                        ${String(pessoa.dia).padStart(2,"0")}/
                        ${String(pessoa.mes).padStart(2,"0")}

                    </span>

                </div>

            `;

        }
    );



    /* opções da dedicatória */

    const select =
        document.getElementById(
            "recipient"
        );


    select.innerHTML = "";


    aniversarios.forEach(
        pessoa => {

            select.innerHTML += `

                <option value="${pessoa.nome}">
                    ${pessoa.nome}
                </option>

            `;

        }
    );

}



/* ========================================
   MEMÓRIAS
======================================== */

function carregarMemorias(){

    const lista =
        document.getElementById(
            "memoryList"
        );


    lista.innerHTML = "";


    memorias.forEach(
        memoria => {

            lista.innerHTML += `

                <div class="event">

                    <span class="event-dot"></span>

                    <span>

                        <strong>
                            ${memoria.dia}
                            de
                            ${meses[memoria.mes - 1]}
                        </strong>

                        —
                        ${memoria.nome}

                    </span>

                </div>

            `;

        }
    );



    const cards =
        document.getElementById(
            "memoryCards"
        );


    cards.innerHTML = "";


    memorias.forEach(
        memoria => {

            cards.innerHTML += `

                <div class="memory-card">

                    <div class="avatar">
                        ♥
                    </div>

                    <h3>
                        ${memoria.nome}
                    </h3>

                    <p>
                        Momento especial
                        da Família Barroso.
                    </p>

                    <span class="date">

                        ${String(memoria.dia).padStart(2,"0")}/
                        ${String(memoria.mes).padStart(2,"0")}

                    </span>

                </div>

            `;

        }
    );

}



/* ========================================
   QR CODE
======================================== */

function criarQR(){

    const url =
        window.location.href
        .split("#")[0] +
        "#familia-barroso-2027";


    const pequeno =
        document.getElementById(
            "qrSmall"
        );


    const grande =
        document.getElementById(
            "qrLarge"
        );


    pequeno.innerHTML = "";

    grande.innerHTML = "";


    if(typeof QRCode !== "undefined"){

        new QRCode(
            pequeno,
            {

                text: url,

                width: 145,

                height: 145,

                colorDark:
                    "#063b91",

                colorLight:
                    "#ffffff"

            }
        );


        new QRCode(
            grande,
            {

                text: url,

                width: 240,

                height: 240,

                colorDark:
                    "#063b91",

                colorLight:
                    "#ffffff"

            }
        );

    }


    document.getElementById(
        "qrUrl"
    ).textContent = url;

}



/* ========================================
   MODAIS
======================================== */

function abrirModal(id){

    document
        .getElementById(id)
        .classList.add("active");

}


function fecharModal(id){

    document
        .getElementById(id)
        .classList.remove("active");

}



/* QR */

document
    .getElementById("openQr")
    .addEventListener(
        "click",
        () => abrirModal("qrModal")
    );


document
    .getElementById("openQr2")
    .addEventListener(
        "click",
        () => abrirModal("qrModal")
    );



/* DEDICATÓRIA */

document
    .getElementById("openDedication")
    .addEventListener(
        "click",
        () =>
            abrirModal(
                "dedicationModal"
            )
    );



/* fechar */

document
    .querySelectorAll("[data-close]")
    .forEach(
        botao => {

            botao.addEventListener(
                "click",
                () => {

                    fecharModal(
                        botao.dataset.close
                    );

                }
            );

        }
    );



/* fechar clicando fora */

document
    .querySelectorAll(".modal")
    .forEach(
        modal => {

            modal.addEventListener(
                "click",
                evento => {

                    if(
                        evento.target === modal
                    ){

                        fecharModal(
                            modal.id
                        );

                    }

                }
            );

        }
    );



/* ESC */

document.addEventListener(
    "keydown",
    evento => {

        if(
            evento.key === "Escape"
        ){

            document
                .querySelectorAll(
                    ".modal.active"
                )
                .forEach(
                    modal =>
                        fecharModal(
                            modal.id
                        )
                );

        }

    }
);



/* ========================================
   DEDICATÓRIAS
======================================== */

function escaparHTML(texto){

    return String(texto)
        .replace(
            /[&<>"']/g,
            caractere => ({

                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"

            })[caractere]
        );

}



function carregarDedicatorias(){

    const dedicacoes =
        JSON.parse(
            localStorage.getItem(
                "familiaBarrosoDedicatorias"
            ) || "[]"
        );


    const container =
        document.getElementById(
            "dedications"
        );


    container.innerHTML = "";


    if(
        dedicacoes.length === 0
    ){

        container.innerHTML = `

            <div class="dedication">

                <strong>
                    Família Barroso ❤️
                </strong>

                <p>
                    “Que este calendário
                    continue a guardar
                    muitos momentos felizes
                    juntos!”
                </p>

                <small>
                    Mensagem inicial
                </small>

            </div>

        `;

        return;

    }


    dedicacoes.forEach(
        dedicacao => {

            container.innerHTML += `

                <div class="dedication">

                    <strong>

                        ${escaparHTML(
                            dedicacao.autor
                        )}

                        →

                        ${escaparHTML(
                            dedicacao.destinatario
                        )}

                    </strong>


                    <p>

                        “${escaparHTML(
                            dedicacao.mensagem
                        )}”

                    </p>


                    <small>

                        ${new Date(
                            dedicacao.data
                        ).toLocaleString(
                            "pt-PT"
                        )}

                    </small>

                </div>

            `;

        }
    );

}



/* ========================================
   FORMULÁRIO
======================================== */

document
    .getElementById(
        "dedicationForm"
    )
    .addEventListener(
        "submit",
        evento => {

            evento.preventDefault();


            const autor =
                document.getElementById(
                    "author"
                ).value.trim();


            const destinatario =
                document.getElementById(
                    "recipient"
                ).value;


            const mensagem =
                document.getElementById(
                    "message"
                ).value.trim();


            const dedicacoes =
                JSON.parse(
                    localStorage.getItem(
                        "familiaBarrosoDedicatorias"
                    ) || "[]"
                );


            dedicacoes.unshift({

                autor,

                destinatario,

                mensagem,

                data:
                    new Date().toISOString()

            });


            localStorage.setItem(

                "familiaBarrosoDedicatorias",

                JSON.stringify(
                    dedicacoes
                )

            );


            evento.target.reset();


            fecharModal(
                "dedicationModal"
            );


            carregarDedicatorias();


            alert(
                "Dedicatória publicada ❤️"
            );

        }
    );



/* ========================================
   MENU MOBILE
======================================== */

document
    .getElementById("menuBtn")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById("menu")
                .classList.toggle(
                    "open"
                );

        }
    );


document
    .querySelectorAll(
        "#menu a"
    )
    .forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    document
                        .getElementById(
                            "menu"
                        )
                        .classList.remove(
                            "open"
                        );

                }
            );

        }
    );



/* ========================================
   BOTÃO HOJE
======================================== */

document
    .getElementById("todayBtn")
    .addEventListener(
        "click",
        () => {

            const hoje =
                new Date();


            if(
                hoje.getFullYear() ===
                ANO
            ){

                const mesesHTML =
                    document.querySelectorAll(
                        ".month"
                    );


                mesesHTML[
                    hoje.getMonth()
                ]?.scrollIntoView({

                    behavior:
                        "smooth",

                    block:
                        "center"

                });

            }
            else{

                document
                    .getElementById(
                        "calendario"
                    )
                    .scrollIntoView({

                        behavior:
                            "smooth"

                    });

            }

        }
    );



/* ========================================
   INICIALIZAÇÃO
======================================== */

carregarCalendario();

carregarAniversarios();

carregarMemorias();

criarQR();

carregarDedicatorias();