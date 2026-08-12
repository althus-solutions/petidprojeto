export function TelecaoBanner() {
  return (
    <div className="overflow-hidden rounded-t-[14px] border border-[#E5E5E5] border-b-0 bg-white shadow-sm">
      <img
        src="/parcerias/telecao-banner.png"
        alt="TeleCão em parceria com Cão Sem Dono"
        className="h-auto w-full object-cover object-center"
      />
      <p className="bg-telecao-50 px-4 py-2 text-center text-[11px] font-semibold text-telecao-700">
        Parceria MyPetID × TeleCão · Adoção responsável
      </p>
    </div>
  )
}
