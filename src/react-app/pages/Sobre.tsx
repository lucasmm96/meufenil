import { Heart, CheckCircle, Lightbulb, Info } from "lucide-react";
import Layout from "@/react-app/components/Layout";
import { useAuth } from "@/react-app/context/AuthContext";
import { LayoutSkeleton, SobreSkeleton } from "@skeletons";

export default function SobrePage() {
  const { ready } = useAuth();

  if (!ready) {
    return (
      <LayoutSkeleton>
        <SobreSkeleton />
      </LayoutSkeleton>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6 sm:space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
            <Heart className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900">
            Sobre o MeuFenil
          </h1>
          <p className="text-base sm:text-lg text-gray-600">
            Uma ferramenta criada com carinho para a comunidade PKU
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 sm:p-8 shadow-lg space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Minha História
          </h2>

          <div className="prose prose-base sm:prose-lg max-w-none text-gray-700 space-y-4 text-left md:text-justify">
            <p>
              Olá! Meu nome é{" "}
              <a
                href="https://www.linkedin.com/in/lucas-martins-menezes/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline hover:text-indigo-800"
              >
                Lucas
              </a>{" "}
              e sou marido de uma paciente com fenilcetonúria. Antes de
              conhecê-la, essa condição era completamente desconhecida para mim.
              A convivência me mostrou o quanto ainda faltam recursos no Brasil
              para pacientes com PKU — como fórmulas mais palatáveis, acesso ao
              Dicloridrato de Sapropterina (
              <a
                href="https://www.biomarin.com/pt-br/kuvan-pku/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline hover:text-indigo-800"
              >
                Kuvan®
              </a>
              ), produtos de baixa proteína e, principalmente, informações
              nutricionais claras sobre a quantidade de fenilalanina nos
              alimentos.
            </p>

            <p>
              Manter uma dieta tão restritiva, com pouca informação disponível,
              é um grande desafio. Por isso, decidi unir meu conhecimento em
              tecnologia à vontade de melhorar a rotina da minha esposa e de
              outras pessoas na mesma condição.
            </p>

            <p>
              Este aplicativo foi criado para ajudar no controle diário da
              ingestão de alimentos e da fenilalanina. Os dados iniciais têm
              como base tabelas públicas disponibilizadas pela{" "}
              <a
                href="https://app.powerbi.com/view?r=eyJrIjoiODNlZDRiZWUtOTM3Ni00ZTBmLTgxYWUtNWUzM2ZkNTk5NTUyIiwidCI6ImI2N2FmMjNmLWMzZjMtNGQzNS04MGM3LWI3MDg1ZjVlZGQ4MSJ9"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline hover:text-indigo-800"
              >
                ANVISA
              </a>
              , e o usuário também pode cadastrar seus próprios alimentos caso
              não os encontre na lista.
            </p>

            <p className="font-semibold text-indigo-600">
              Este é um projeto totalmente sem fins lucrativos, com o único
              objetivo de contribuir — mesmo que um pouco — para uma melhor
              qualidade de vida das pessoas com fenilcetonúria.
            </p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 sm:p-8 shadow-lg space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Como Usar o App
            </h2>
          </div>

          <div className="space-y-5">
            {[
              {
                t: "Configure seu Perfil",
                d: "Acesse a página 'Perfil' e defina seu limite diário de fenilalanina em miligramas conforme orientação do seu nutricionista ou médico.",
              },
              {
                t: "Registre suas Refeições",
                d: "No Dashboard, clique em 'Adicionar Registro'. Busque o alimento, informe o peso consumido e veja automaticamente a quantidade de fenilalanina calculada.",
              },
              {
                t: "Crie Alimentos Personalizados",
                d: "Não encontrou um alimento? Clique em 'Criar Novo Alimento' para adicionar suas próprias referências com os valores nutricionais corretos.",
              },
              {
                t: "Acompanhe suas Estatísticas",
                d: "Visualize gráficos e relatórios do seu consumo ao longo do tempo. Use a página 'Estatísticas' para analisar padrões e ajustar sua dieta.",
              },
              {
                t: "Registre seus Exames",
                d: "Na página 'Exames PKU', registre os resultados dos seus exames de fenilcetonúria em mg/dL e acompanhe a evolução ao longo do tempo.",
              },
              {
                t: "Exporte seus Dados",
                d: "No seu perfil, você pode exportar todos os seus dados em CSV ou JSON para compartilhar com profissionais de saúde ou fazer backup.",
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-3 sm:gap-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {i + 1}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                    {item.t}
                  </h3>
                  <p className="text-gray-600 text-sm sm:text-base">
                    {item.d}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 sm:p-8 shadow-lg space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Principais Recursos
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
            {[
              ["Banco de Alimentos", "Mais de 1000 alimentos com valores da ANVISA"],
              ["Cálculo Automático", "Fenilalanina calculada instantaneamente"],
              ["Histórico Completo", "Acesse todo seu histórico de consumo"],
              ["Gráficos e Estatísticas", "Visualize tendências e padrões"],
              ["Controle de Exames", "Registre e acompanhe seus exames PKU"],
              ["Exportação de Dados", "CSV e JSON para seus registros"],
              ["Conformidade LGPD", "Seus dados seguros e privados"],
              ["PWA / Mobile", "Funciona como app no celular"],
            ].map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl bg-gray-50"
              >
                <CheckCircle className="w-5 h-5 text-gray-700 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">
                    {r[0]}
                  </h4>
                  <p className="text-sm text-gray-600">{r[1]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-xl p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-yellow-900">
                Aviso Importante
              </h3>
              <p className="text-sm text-yellow-800">
                Este aplicativo é uma ferramenta de auxílio no controle da
                fenilcetonúria. Ele não substitui o acompanhamento médico e
                nutricional profissional. Sempre consulte seu médico e
                nutricionista para orientações sobre sua dieta e tratamento. Os
                valores nutricionais são baseados em tabelas públicas e podem
                variar entre marcas e preparos.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 sm:p-8 text-center text-white shadow-lg space-y-3">
          <Heart className="w-10 h-10 sm:w-12 sm:h-12 mx-auto animate-pulse" />
          <h3 className="text-xl sm:text-2xl font-bold">
            Obrigado por usar o MeuFenil!
          </h3>
          <p className="text-indigo-100 text-sm sm:text-base">
            Juntos, podemos tornar o controle da PKU mais simples e acessível
            para todos.
          </p>
        </div>
      </div>
    </Layout>
  );
}